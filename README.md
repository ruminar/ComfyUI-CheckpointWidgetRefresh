# ComfyUI-CheckpointWidgetRefresh

ComfyUIを再起動せずに、Checkpoint系の選択リストを現在のファイル状態へ同期する小さなUIノードじゃ！

「新しいモデルをディレクトリに置いたのに、リストに出てこないのう……再起動は面倒じゃし……」
そんなおぬしの“平常運転な悩み”を、フロントエンドだけでなくバックエンドまで含めた鮮やかなパッチワークで解決して進ぜよう！

## 特徴

- **再起動いらずの即時同期** <br/>
  ボタンをポチッと押すだけで、新しく追加したモデルが選択肢に並び、削除したモデルは綺麗に消えるぞ。

- **標準ノードにも対応** <br/>
  自作ノードだけでなく、標準の `CheckpointLoaderSimple` も更新対象じゃ。

- **バックエンドまで貫くパッチ** <br/>
  ブラウザ上の表示を変えるだけではない。Python側の型定義（`INPUT_TYPES` など）まで更新するため、バリデーションで弾かれる心配も少ないのじゃ。

- **徹底した軽量設計** <br/>
  常時監視やポーリングは一切しない。おぬしが「今だ！」とボタンを押した時だけ動く、ワークフローの邪魔をしない奥ゆかしい実用品じゃ。

## 導入方法

ComfyUIの `custom_nodes` ディレクトリで、以下のコマンドを打ち込むのじゃ！

```bash
git clone https://github.com/ruminar/ComfyUI-CheckpointWidgetRefresh.git
````

## 使い方

1. **Checkpointを追加・削除する** <br/>
   いつものようにモデルフォルダを整理するのじゃ。

2. **ノードを追加する** <br/>
   `Checkpoint Widget Refresh` ノードをキャンバスのどこかに置く。
   （配線は不要じゃ！）

3. **ボタンを押す** <br/>
   `Refresh Checkpoint Widgets` ボタンを押せば、対象ノードの選択肢が最新状態に更新されるぞ！

<br/>

   <img width="982" height="418" alt="image" src="https://github.com/user-attachments/assets/112b8c0c-b2da-4d55-a622-5dbd0af9d2be" />

## 対応ノード

* `CheckpointLoaderSimple`
* `CheckpointNameSelector` 系ノード

## ライセンス

GPL-3.0
（ComfyUI本体の掟に従っておるぞ！）

## 説明画像

<img width="1024" height="1536" alt="ComfyUI-CheckpointWidgetRefresh説明" src="https://github.com/user-attachments/assets/d1b7e020-5f60-4ad8-a006-639ae3335fe4" />

<br/>
