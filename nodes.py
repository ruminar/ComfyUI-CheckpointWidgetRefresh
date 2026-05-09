import os
from aiohttp import web

import folder_paths
from server import PromptServer


def _get_supported_checkpoint_extensions():
    default_extensions = {".ckpt", ".pt", ".bin", ".pth", ".safetensors"}
    extensions = getattr(folder_paths, "supported_pt_extensions", None)
    if not extensions:
        return default_extensions
    return {str(ext).lower() for ext in extensions}


def _clear_checkpoint_filename_cache():
    cache = getattr(folder_paths, "filename_list_cache", None)
    if isinstance(cache, dict):
        cache.pop("checkpoints", None)


def _scan_registered_checkpoint_folders():
    results = set()
    extensions = _get_supported_checkpoint_extensions()

    try:
        roots = folder_paths.get_folder_paths("checkpoints")
    except Exception:
        roots = []

    for root in roots:
        if not root or not os.path.isdir(root):
            continue

        for dirpath, _dirnames, filenames in os.walk(root):
            for filename in filenames:
                _, ext = os.path.splitext(filename)
                if ext.lower() not in extensions:
                    continue

                full_path = os.path.join(dirpath, filename)
                rel_path = os.path.relpath(full_path, root)
                rel_path = rel_path.replace("\\", "/")
                results.add(rel_path)

    return sorted(results, key=lambda value: value.lower())


def _get_fresh_checkpoints():
    _clear_checkpoint_filename_cache()

    results = set()

    try:
        results.update(folder_paths.get_filename_list("checkpoints"))
    except Exception:
        pass

    try:
        results.update(_scan_registered_checkpoint_folders())
    except Exception:
        pass

    return sorted(results, key=lambda value: value.lower())


def _patch_backend_checkpoint_classes(checkpoints):
    patched = []

    try:
        import nodes as comfy_nodes
    except Exception:
        return patched

    mappings = getattr(comfy_nodes, "NODE_CLASS_MAPPINGS", {})
    checkpoint_values = list(checkpoints)

    for class_name, node_class in list(mappings.items()):
        name = str(class_name)

        try:
            if "CheckpointNameSelector" in name:
                def selector_input_types(cls, _checkpoint_values=checkpoint_values):
                    return {
                        "required": {
                            "ckpt_name": (list(_checkpoint_values),),
                        },
                    }

                node_class.INPUT_TYPES = classmethod(selector_input_types)
                node_class.RETURN_TYPES = (list(checkpoint_values), "STRING")
                patched.append(name)
                continue

            if name == "CheckpointLoaderSimple":
                def loader_input_types(cls, _checkpoint_values=checkpoint_values):
                    return {
                        "required": {
                            "ckpt_name": (list(_checkpoint_values),),
                        },
                    }

                node_class.INPUT_TYPES = classmethod(loader_input_types)
                patched.append(name)
                continue

            if name == "CheckpointNameCycler":
                def cycler_input_types(cls, _checkpoint_values=checkpoint_values):
                    values = list(_checkpoint_values) or [""]
                    return {
                        "required": {
                            "start_checkpoint": (values,),
                            "mode": (["fixed", "increment", "randomize", "shuffle_once"], {"default": "increment"}),
                            "change_every": ("INT", {"default": 1, "min": 1, "max": 999999}),
                        },
                        "hidden": {
                            "unique_id": "UNIQUE_ID",
                        },
                    }

                node_class.INPUT_TYPES = classmethod(cycler_input_types)
                node_class.RETURN_TYPES = (
                    list(checkpoint_values),
                    "STRING",
                    "STRING",
                    "INT",
                    "INT",
                    "INT",
                )
                patched.append(name)
                continue

        except Exception as exc:
            print(f"[CheckpointWidgetRefresh] failed to patch {name}: {exc}")

    return patched


routes = PromptServer.instance.routes


@routes.get("/checkpoint_widget_refresh/checkpoints")
async def checkpoint_widget_refresh_checkpoints(_request):
    checkpoints = _get_fresh_checkpoints()
    patched = _patch_backend_checkpoint_classes(checkpoints)

    return web.json_response({
        "checkpoints": checkpoints,
        "count": len(checkpoints),
        "patched_classes": patched,
        "patched_class_count": len(patched),
    })


class CheckpointWidgetRefreshPanel:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
        }

    RETURN_TYPES = ()
    FUNCTION = "noop"
    CATEGORY = "utils/model"

    def noop(self):
        return ()


NODE_CLASS_MAPPINGS = {
    "CheckpointWidgetRefreshPanel": CheckpointWidgetRefreshPanel,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "CheckpointWidgetRefreshPanel": "Checkpoint Widget Refresh",
}
