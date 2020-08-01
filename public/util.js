/**
 * [Wrapper] document.querySelector
 *
 * @param  {string} selector "#foo", ".bar"
 * @return {object}
 */
function $(selector){
  return( document.querySelector(selector) );
}


/**
 * キャラクター画像管理用クラス
 */
class CharaImage {
  /**
   * コンストラクタ
   */
  constructor(list, callback=null){
    //------------------------------
    // プロパティ
    //------------------------------
    this.list   = list;   // 画像URLリスト
    this.images = null;   // 画像データを入れる箱

    // 画像のロード管理
    this.loadcount = 0;   // ロード済み画像の枚数
    this.loaded = false;  // 全画像ロード済み:true, まだ:false

    //------------------------------
    // 処理開始
    //------------------------------
    this.images = this._load();    // ロード
    this._watch(callback);         // ロード状態を監視
  }

  /**
   * 画像をロードする
   */
  _load(){
    const images = [];
    for(let i=0; i<this.list.length; i++){
      images[i] = new Image();
      images[i].src = this.list[i];
      images[i].onload = ()=>{
        this.loadcount++;
      }
    }
    return(images);
  }

  /**
   * 画像のロード状態を監視
   */
  _watch(callback){
    // 100ms毎にカウンターの値をチェック
    const timerid = setInterval(()=>{
        if( this.list.length === this.loadcount ){
          this.loaded = true;      // 完了フラグを立てる
          clearInterval(timerid);  // タイマー解除

          if( callback !== null ){
            callback();
          }
        }
      }
      , 100
    );
  }

  /**
   * 画像データを返却
   */
  getImage(i=0){
    // ロード完了前なら返さない
    if( ! this.loaded ){
      return(false);
    }

    return(this.images[i]);
  }
}
