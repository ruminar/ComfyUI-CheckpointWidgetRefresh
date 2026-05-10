# v0.2.0

CheckpointNameCyclerとの連携機能を追加したのじゃ！

## 追加

- `Checkpoint Name Cycler` との連携に対応
- `CheckpointNameCycler` の候補リスト更新に対応
- `CheckpointNameCycler` のバックエンド側型定義更新に対応
- `CheckpointNameCycler` の内部状態リセットAPI呼び出しに対応

## 既存機能

- ComfyUIを再起動せずに、Checkpoint系の選択リストを現在のファイル状態へ同期
- 標準の `CheckpointLoaderSimple` に対応
- `CheckpointNameSelector` 系ノードにも対応
- フロントエンドのWidget候補だけでなく、バックエンド側の型定義も更新
- 常時監視やポーリングなしの手動更新方式

## 備考

動作確認は、標準の `CheckpointLoaderSimple`、art-venture の `CheckpointNameSelector`、および `Checkpoint Name Cycler` で行っています。