//自分自身の情報を入れる箱
const IAM = {
  token: null,    // トークン
  chara: null,    // キャラ
  is_join: false  // 入室中？
};

// メンバー一覧を入れる箱
const MEMBER = {};
  // ↑以下のような内容のデータが入る
  // {
  //   1: {chara:2, pos:{x:1, y:1}},
  //   2: {chara:3, pos:{x:1, y:1}}
  // }
  //
  // ※連想配列のキーはサーバから送られてくるtoken

// メンバー一覧のソート用
const MEMBER_SORT = [];

// Socket.ioのクライアント
const socket = io({
  autoConnect: false  // 即時接続"しない"
});

// Canvas関係
const canvas = document.querySelector("#battlefield");
const ctx = canvas.getContext("2d");

//-------------------------------------
// STEP0. アセットの事前ロード
//-------------------------------------
const imagelist = [
  "/image/1.png",
  "/image/2.png",
  "/image/3.png"
];

// 画像をロードする
const charaImage =  new CharaImage(imagelist, ()=>{
  // STEP1を実行
  connectServer();
});


//-------------------------------------
// STEP1. Socket.ioサーバへ接続
//-------------------------------------
/**
 * Socket.ioサーバへ接続する
 */
function connectServer(){
  // 表示切り替え
  if( ! IAM.is_join ){
    $("#nowloading").style.display = "none";        // ローディングを非表示
    $("#nowconnecting").style.display = "block";    // 「接続中」を表示
  }

  // Socket.ioサーバへ接続する
  socket.open();
}

/**
 * [イベント] トークンが発行されたら
 */
socket.on("token", (data)=>{
  // トークンを保存
  IAM.token = data.token;

  // 表示を切り替える
  if( ! IAM.is_join ){
    $("#nowconnecting").style.display = "none";    // 「接続中」を非表示
    $("#inputmychara").style.display = "block";    // キャラ選択を表示
  }
});

//-------------------------------------
// STEP2. キャラクター選択
//-------------------------------------
/**
 * [イベント] キャラ選択フォームが送信された
 */
$("#frm-chara").addEventListener("submit", (e)=>{
  // 規定の送信処理をキャンセル(画面遷移しないなど)
  e.preventDefault();

  // 入力内容を取得する
  IAM.chara = $("#frm-chara input[name='radio-mychara']:checked").value;

  // Socket.ioサーバへ送信
  socket.emit("join", {token:IAM.token, chara:IAM.chara});
});

/**
 * [イベント] 入室結果が返ってきた
 */
socket.on("join-result", (data)=>{
  //------------------------
  // 正常に入室できた
  //------------------------
  if( data.status ){
    // 入室フラグを立てる
    IAM.is_join = true;

    // すでに入室中のユーザーをMEMBERへ入れる
    for( let i=0; i<data.users.length; i++ ){
      const cur = data.users[i];
      MEMBER[cur.token] = {chara:cur.chara, pos:cur.pos};
      MEMBER_SORT.push(cur.token);
    }

    // 表示を切り替える
    $("#inputmychara").style.display = "none";   // キャラ選択を非表示
    $("#battle").style.display = "block";        // 対戦画面を表示

    // 対戦開始
    startBattle();
  }
  //------------------------
  // できなかった
  //------------------------
  else{
    alert("入室できませんでした");
    console.log(data);
  }
});


//-------------------------------------
// STEP3. 対戦開始
//-------------------------------------
function startBattle(){
  canvas.setAttribute("tabindex", 0);
  canvas.focus();

  // キーボード押下時のイベントを設定
  canvas.addEventListener("keydown",  (e) => {
    // Socket.ioサーバへ送信
    socket.emit("move", {token:IAM.token, key:e.keyCode});
  });

  // 描画スタート
  update();
}

/**
 * 毎フレーム実行
 */
function update(){
  draw();
  window.requestAnimationFrame(update);
}

/**
 * 描画処理
 */
function draw(){
  // Canvasの全領域をクリア
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // キャラクターを描画
  for ( let i=0; i<MEMBER_SORT.length; i++) {
    const token = MEMBER_SORT[i];
    const chara = MEMBER[token].chara - 1;
    const pos   = MEMBER[token].pos;
    ctx.drawImage(charaImage.getImage(chara), pos.x, pos.y);
  }
}


/**
 * [イベント] 誰かが入室した
 */
socket.on("member-join", (data)=>{
  MEMBER[data.token] = {chara:data.chara, pos:data.pos};
  MEMBER_SORT.push(data.token);
});

/**
 * [イベント] 誰かが移動した
 */
socket.on("member-move", (data)=>{
  if( data.token in MEMBER ){
    MEMBER[data.token].pos = data.pos;
  }
});

/**
 * [イベント] 誰かが退室した
 */
socket.on("member-quit", (data)=>{
  // MEMBER_SORT配列から削除
  const index = MEMBER_SORT.indexOf(data.token);
  if (index > -1) {
    MEMBER_SORT.splice(index, 1);
  }

  // MEMBER配列から削除
  if( data.token in MEMBER ){
    delete MEMBER[data.token];
  }
});
