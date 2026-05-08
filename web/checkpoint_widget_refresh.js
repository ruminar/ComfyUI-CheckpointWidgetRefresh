import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const EXTENSION_NAME = "ruminar.CheckpointWidgetRefresh";
const REFRESHER_NODE_NAME = "CheckpointWidgetRefreshPanel";

let lastCheckpointList = null;

function getNodeTypeName(node) {
    return String(
        node?.type ??
        node?.comfyClass ??
        node?.constructor?.type ??
        ""
    );
}

function getNodeDataName(nodeData) {
    return String(nodeData?.name ?? "");
}

function isRefresherNode(node) {
    return getNodeTypeName(node) === REFRESHER_NODE_NAME;
}

function findCheckpointWidget(node) {
    const widgets = node?.widgets ?? [];
    return widgets.find((widget) =>
        widget?.name === "ckpt_name" &&
        Array.isArray(widget?.options?.values)
    );
}

function outputNames(node) {
    return (node?.outputs ?? []).map((output) =>
        String(output?.name ?? "").toLowerCase()
    );
}

function hasSelectorOutputs(node) {
    const names = outputNames(node);
    return names.includes("ckpt_name") && names.includes("ckpt_name_str");
}

function hasLoaderOutputs(node) {
    const names = outputNames(node);
    return names.includes("model") && names.includes("clip") && names.includes("vae");
}

function shouldTargetNode(node) {
    if (!node || isRefresherNode(node)) {
        return false;
    }

    const typeName = getNodeTypeName(node);

    if (typeName.includes("CheckpointNameSelector")) {
        return true;
    }

    if (typeName === "CheckpointLoaderSimple") {
        return true;
    }

    if (hasSelectorOutputs(node) && Boolean(findCheckpointWidget(node))) {
        return true;
    }

    if (hasLoaderOutputs(node) && Boolean(findCheckpointWidget(node))) {
        return true;
    }

    return false;
}

function shouldPatchFutureNodeType(nodeData) {
    const name = getNodeDataName(nodeData);
    if (name === REFRESHER_NODE_NAME) {
        return true;
    }

    return name.includes("CheckpointNameSelector") || name === "CheckpointLoaderSimple";
}

function chooseReplacement(oldValues, newValues, currentValue) {
    if (!Array.isArray(newValues) || newValues.length === 0) {
        return "";
    }

    if (newValues.includes(currentValue)) {
        return currentValue;
    }

    const oldIndex = Array.isArray(oldValues) ? oldValues.indexOf(currentValue) : -1;

    if (oldIndex >= 0) {
        // Prefer the next surviving item from the old list.
        for (let index = oldIndex + 1; index < oldValues.length; index++) {
            const candidate = oldValues[index];
            if (newValues.includes(candidate)) {
                return candidate;
            }
        }

        // If the deleted item was at the end, choose the previous survivor.
        for (let index = oldIndex - 1; index >= 0; index--) {
            const candidate = oldValues[index];
            if (newValues.includes(candidate)) {
                return candidate;
            }
        }

        // Last fallback: same numeric position in the new list if possible.
        return newValues[Math.min(oldIndex, newValues.length - 1)] ?? newValues[0];
    }

    return newValues[0];
}

function arraysEqual(left, right) {
    if (!Array.isArray(left) || !Array.isArray(right)) {
        return false;
    }
    if (left.length !== right.length) {
        return false;
    }
    for (let index = 0; index < left.length; index++) {
        if (left[index] !== right[index]) {
            return false;
        }
    }
    return true;
}

function patchCheckpointSlotTypes(node, checkpoints) {
    const values = [...checkpoints];

    for (const output of node.outputs ?? []) {
        if (String(output?.name ?? "") !== "ckpt_name") {
            continue;
        }

        output.type = [...values];

        const links = Array.isArray(output.links) ? output.links : [];
        for (const linkId of links) {
            const link = app.graph?.links?.[linkId];
            if (!link) {
                continue;
            }

            const targetNode = app.graph?.getNodeById?.(link.target_id);
            const targetInput = targetNode?.inputs?.[link.target_slot];
            if (targetInput && String(targetInput.name ?? "").toLowerCase().includes("ckpt")) {
                targetInput.type = [...values];
            }
        }
    }

    for (const input of node.inputs ?? []) {
        if (String(input?.name ?? "").toLowerCase().includes("ckpt")) {
            input.type = [...values];
        }
    }
}

function applyCheckpointListToNode(node, checkpoints) {
    if (!shouldTargetNode(node)) {
        return {
            matched: false,
            changed: false,
            valueChanged: false,
        };
    }

    const widget = findCheckpointWidget(node);
    if (!widget) {
        return {
            matched: true,
            changed: false,
            valueChanged: false,
            reason: "checkpoint widget not found",
        };
    }

    if (!widget.options) {
        widget.options = {};
    }

    const oldValues = Array.isArray(widget.options.values)
        ? [...widget.options.values]
        : [];

    const oldValue = widget.value;
    const newValues = [...checkpoints];
    const newValue = chooseReplacement(oldValues, newValues, oldValue);

    widget.options.values = newValues;
    widget.value = newValue;
    patchCheckpointSlotTypes(node, newValues);

    const valuesChanged = !arraysEqual(oldValues, newValues);
    const valueChanged = oldValue !== newValue;

    if (valueChanged && typeof widget.callback === "function") {
        try {
            widget.callback(widget.value);
        } catch (error) {
            console.warn("[CheckpointWidgetRefresh] widget callback failed", error);
        }
    }

    if (valuesChanged || valueChanged) {
        node.setDirtyCanvas?.(true, true);
    }

    return {
        matched: true,
        changed: valuesChanged || valueChanged,
        valueChanged,
        oldValue,
        newValue,
    };
}

async function fetchCheckpointList() {
    const response = await api.fetchApi("/checkpoint_widget_refresh/checkpoints", {
        cache: "no-store",
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    return {
        checkpoints: Array.isArray(payload.checkpoints) ? payload.checkpoints : [],
        patchedClassCount: payload.patched_class_count ?? 0,
        patchedClasses: Array.isArray(payload.patched_classes) ? payload.patched_classes : [],
    };
}

function updatePanelTitle(panelNode, text) {
    if (!panelNode) {
        return;
    }

    panelNode.title = text;
    panelNode.setDirtyCanvas?.(true, true);
    app.graph?.setDirtyCanvas?.(true, true);
}

async function refreshCheckpointWidgets(panelNode = null) {
    updatePanelTitle(panelNode, "Refreshing checkpoint widgets...");

    const payload = await fetchCheckpointList();
    const checkpoints = payload.checkpoints;
    lastCheckpointList = checkpoints;

    let matched = 0;
    let changed = 0;
    let valueChanged = 0;

    for (const node of app.graph?._nodes ?? []) {
        const result = applyCheckpointListToNode(node, checkpoints);
        if (!result.matched) {
            continue;
        }

        matched += 1;
        if (result.changed) {
            changed += 1;
        }
        if (result.valueChanged) {
            valueChanged += 1;
            console.log(
                `[CheckpointWidgetRefresh] ${getNodeTypeName(node)} #${node.id}: ` +
                `${result.oldValue} -> ${result.newValue}`
            );
        }
    }

    const title = `Updated ${changed}/${matched} ckpt widgets, ${checkpoints.length} ckpts`;
    updatePanelTitle(panelNode, title);

    console.log(
        `[CheckpointWidgetRefresh] ${title}. ` +
        `valueChanged=${valueChanged}, backend patched=${payload.patchedClassCount}`,
        payload.patchedClasses
    );

    app.graph?.setDirtyCanvas?.(true, true);
}

function installRefreshPanelWidgets(node) {
    if (!node || node._checkpointWidgetRefreshWidgetsInstalled) {
        return;
    }

    node.addWidget(
        "button",
        "Refresh Checkpoint Widgets",
        "refresh",
        async () => {
            try {
                await refreshCheckpointWidgets(node);
            } catch (error) {
                console.error("[CheckpointWidgetRefresh] refresh failed", error);
                updatePanelTitle(node, "Refresh failed. See console.");
            }
        }
    );

    node.title = "Checkpoint Widget Refresh";
    node.size = [320, 60];
    node._checkpointWidgetRefreshWidgetsInstalled = true;
}

function installFuturePatchHook(nodeType, nodeData) {
    if (!shouldPatchFutureNodeType(nodeData)) {
        return;
    }

    const originalOnNodeCreated = nodeType.prototype.onNodeCreated;

    nodeType.prototype.onNodeCreated = function (...args) {
        const result = originalOnNodeCreated?.apply(this, args);

        if (getNodeDataName(nodeData) === REFRESHER_NODE_NAME) {
            installRefreshPanelWidgets(this);
            return result;
        }

        if (lastCheckpointList) {
            setTimeout(() => {
                applyCheckpointListToNode(this, lastCheckpointList);
                app.graph?.setDirtyCanvas?.(true, true);
            }, 0);
        }

        return result;
    };
}

app.registerExtension({
    name: EXTENSION_NAME,

    beforeRegisterNodeDef(nodeType, nodeData) {
        installFuturePatchHook(nodeType, nodeData);
    },
});
