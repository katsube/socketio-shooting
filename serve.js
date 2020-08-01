/**
 * Socket.ioを使用したキャラ移動 その3
 * https://socket.io/get-started/chat/
 */

//--------------------------------------
// モジュール
//--------------------------------------
const crypto = require("crypto");
const app  = require("express")();
const http = require("http").Server(app);
const io   = require("socket.io")(http);

//-----------------------------------------------
// 定数
//-----------------------------------------------
// HTTPサーバのポート
const PORT = 3000;

// HTMLやJSなどを配置するディレクトリ
const DOCUMENT_ROOT = __dirname + "/public";

// トークンを作成する際の秘密鍵
const SECRET_TOKEN = "abcdefghijklmn12345";

// Canvasサイズ
const MAX_WIDTH  = 600;     // 横幅
const MAX_HEIGHT = 400;     // 高さ

//-----------------------------------------------
// グローバル変数
//-----------------------------------------------
// 参加者一覧
const MEMBER = {};
  // ↑以下のような内容のデータが入る
  // {
  //   "socket.id": {token:"abcd", count:1, chara:1, pos:{x:1, y:1}},
  //   "socket.id": {token:"efgh", count:2, chara:2, pos:{x:1, y:1}}
  // }

// 参加者を順番に取り出す用の配列
const MEMBER_SORT = [];

// 延べ参加者数
let MEMBER_COUNT = 1;


//-----------------------------------------------
// HTTPサーバ (express)
//-----------------------------------------------
/**
 * "/"にアクセスがあったらindex.htmlを返却
 */
app.get("/", (req, res)=>{
  res.sendFile(DOCUMENT_ROOT + "/index.html");
});
/**
 * その他のファイルへのアクセス
 * (app.js, style.cssなど)
 */
app.get("/:file", (req, res)=>{
  res.sendFile(DOCUMENT_ROOT + "/" + req.params.file);
});
/**
 * 画像ファイルへのアクセス
 * (/image/xxx.png)
 */
app.get("/image/:file", (req, res)=>{
  res.sendFile(DOCUMENT_ROOT + "/image/" + req.params.file);
});

// 実は上の指定は↓のように一発で書くことも可能です
// app.use(express.static(DOCUMENT_ROOT));


//--------------------------------------
// Socket.io
//--------------------------------------
/**
 * [イベント] ユーザーが接続
 */
io.on("connection", (socket)=>{
  //---------------------------------
  // トークンを返却
  //---------------------------------
  (()=>{
    // トークンを作成
    const token = makeToken(socket.id);

    // ユーザーリストに追加
    MEMBER[socket.id] = {token:token, count:MEMBER_COUNT, chara:null, pos:null};
    MEMBER_COUNT++;

    // 本人にトークンを送付
    io.to(socket.id).emit("token", {token:token});
  })();

  /**
   * [イベント] 入室する
   */
  socket.on("join", (data)=>{
    // トークンをチェック
    if( ! authToken(socket.id, data.token) ){
      io.to(socket.id).emit("join-result", {status:false, message:"不正なトークンです"});
      return(false);
    }

    // 初期座標を決定
    const pos = {
      x: getInitPos(MAX_WIDTH),
      y: getInitPos(MAX_HEIGHT)
    };

    // 一覧に追加
    MEMBER[socket.id].pos = pos;           // 初期座標
    MEMBER[socket.id].chara = data.chara;  // キャラクター(1〜3)
    MEMBER_SORT.push(socket.id);

    // 送信者のみに通知
    io.to(socket.id).emit("join-result", {status:true, users:getMemberList(socket.id)});
    io.to(socket.id).emit("member-join", {
      token: MEMBER[socket.id].token,   // 秘密トークン
      chara: data.chara,                // 選択キャラ
      pos: pos                          // 初期座標
    });

    // 送信者以外のユーザーに通知
    socket.broadcast.emit("member-join", {
      token: MEMBER[socket.id].count,   // 公開トークン
      chara: data.chara,                // 選択キャラ
      pos: pos                          // 初期座標
    });
  });

  /**
   * [イベント] キャラクターの動きを同期
   */
  socket.on("move", (data)=>{
    // トークンをチェック
    if( ! authToken(socket.id, data.token) ){
      io.to(socket.id).emit("move-result", {status:false, message:"不正なトークンです"});
      return(false);
    }

    // サーバ内で座標を計算
    const pos = moveChar(socket.id, data.key);
    MEMBER[socket.id].pos = pos;      // 計算後の座標をセット

    // 送信者のみに通知
    io.to(socket.id).emit("member-move", {
      token: data.token,   // 非公開トークン
      pos: pos             // 座標
    });

    // 送信者以外のユーザーに通知
    socket.broadcast.emit("member-move", {
      token: MEMBER[socket.id].count,   // 公開トークン
      pos: pos                          // 座標
    });
  });

  /**
   * [イベント] 切断
   *
   * 強制的にSocket.ioサーバから切断された際に発生する
   */
  socket.on("disconnect", ()=>{
    // 一斉送信
    socket.broadcast.emit("member-quit", {token:MEMBER[socket.id].count});

    // MEMBER_SORT配列から削除
    const index = MEMBER_SORT.indexOf(socket.id);
    if (index > -1) {
      MEMBER_SORT.splice(index, 1);
    }

    // MEMBERから削除
    if( socket.id in MEMBER ){
      delete MEMBER[socket.id];
    }
  });
});

//-----------------------------------------------
// 3000番でサーバを起動する
//-----------------------------------------------
http.listen(PORT, ()=>{
  console.log(`listening on *:${PORT}`);
});



/**
 * キャラの初期座標を決定する (x, y共通)
 *
 * @param {integer} size
 * @return {integer}
 */
function getInitPos(size){
  const min = Math.floor(size / 30);  // 端の30%は使わない
  const max = size - min;             // 同上
  return(
    Math.floor( min + (Math.random() * max) )
  );
}

/**
 * キャラクターを押されたキーに合わせて移動
 *
 * @param {string}  token  プレイヤー識別用の文字列
 * @param {integer} keycd  押下されたキーボード
 * @param {integer} step   1回の移動量
 * @return {object}
 */
function moveChar(token, keycd, step=10){
  const pos = MEMBER[token].pos;    // 現在の座標を取得
  let x, y;

  // キャラの移動先を計算する
  switch(keycd){
    case 87:  //w
      x = pos.x;
      y = pos.y - step;
      break;
    case 65:   //a
      x = pos.x - step;
      y = pos.y;
      break;
    case 83:  //s
      x = pos.x;
      y = pos.y + step;
      break;
    case 68:  //d
      x = pos.x + step;
      y = pos.y;
      break;
    default:
      x = pos.x;
      y = pos.y;
      break;
  }

  console.log(`moveChar: token=${token}, keycd=${keycd}, x=${x}, y=${y}`);
  return({x:x, y:y});
}

/**
 * トークンを作成する
 *
 * @param  {string} id - socket.id
 * @return {string}
 */
function makeToken(id){
  const str = SECRET_TOKEN + id;
  return( crypto.createHash("sha1").update(str).digest('hex') );
}

/**
 * 本人からの通信か確認する
 *
 * @param {string} socketid
 * @param {string} token
 * @return {boolean}
 */
function authToken(socketid, token){
  return(
    (socketid in MEMBER) && (token === MEMBER[socketid].token)
  );
}

/**
 * メンバー一覧を作成する
 *
 * @param {string} socketid
 * @return {array}
 */
function getMemberList(socketid){
  const list = [];
  for(let i=0; i<MEMBER_SORT.length; i++){
    const id = MEMBER_SORT[i];
    const cur = MEMBER[id];
    if( id !== socketid ){
      list.push({token:cur.count, chara:cur.chara, pos:cur.pos});
    }
  }
  return(list);
}