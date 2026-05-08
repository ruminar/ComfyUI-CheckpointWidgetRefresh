# v0.1.0

初回リリースじゃ！

## 特徴

- ComfyUIを再起動せずに、Checkpoint系の選択リストを現在のファイル状態へ同期
- 標準の `CheckpointLoaderSimple` に対応
- `CheckpointNameSelector` 系ノードにも対応
- フロントエンドのWidget候補だけでなく、バックエンド側の型定義も更新
- 常時監視やポーリングなしの手動更新方式

## 使い方

1. Checkpointを追加・削除する
2. `Checkpoint Widget Refresh` ノードをキャンバスに置く
3. `Refresh Checkpoint Widgets` ボタンを押す
4. そのまま作画する

## 備考

動作確認は、標準の `CheckpointLoaderSimple` と art-venture の `CheckpointNameSelector` で行っています。