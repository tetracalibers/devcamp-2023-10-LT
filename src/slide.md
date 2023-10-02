# GLSLで画像加工

ひたすらピクセルをいじりたい

Note:

画像加工アプリを作っています。

GLSLで画像加工フィルタを書いて、WebGLで動かすという試みです。

---

<img src="/image/preview/editor-preview.png" class="r-stretch" style="box-shadow: 0px 25px 80px rgba(0, 0, 0, 0.15);" />

Note:

今のところアプリはこんな感じです。

内部実装の整理ができていないので動作が重めなのと、スマホにはまだ対応していないので注意です。

アプリでは、画像の一部にのみフィルタを適用することができるようにしています。

移動モードをONにし、画像をドラッグすると、フィルタを適用する範囲の中心を変更できます。
適用範囲の半径はスライダーで調整できます。

また、メインのフィルタに加えて、ぼかしやコントラスト調整などを重ねて行うこともできます。

---

# フィルタを重ねる仕組み

2つのフレームバッファを一時レイヤーとして、Swap

1. テクスチャAに元画像を書き出す
2. テクスチャAを加工し、結果をテクスチャBに書き出す
3. テクスチャBを加工し、結果をテクスチャAに書き出す
4. ...loop...
5. 最終結果を書き出したテクスチャをcanvasに描画

Note:

このようなフィルタの同時適用は、2枚の一時レイヤーを用意し、交互に使うことで実現しています。

Three.jsなどのライブラリは使わずに、WebGLのラッパーを自作するところから始めています。

---

# Fragment Shaderはローカル視点

```js
for (let u = 0; u < imgWidth; u++) {
  for (let v = 0; v < imgHeight; v++) {
    // ここの処理を書くようなイメージ
  }
}
```

- 各位置の色を決定するシェーダ
- 1ピクセルごとに実行される（for文とは違い、並列で）
- 全体のことは知りません

Note:

各レイヤーに書き出す色は、GLSLで書いたフラグメントシェーダで計算します。

画像から各ピクセルの色を取り出し、数式で加工していきます。

---

# 今回のラインナップ

NPR（non-photorealistic rendering）を中心に

- デッサン風
- 色鉛筆画風
- ステンドグラス風
- モザイク

Note:

特に、画像を絵画風に加工するフィルタの実装を研究しています。

---

# デッサン風

Note:

まずはデッサン風

---

<!-- .element data-transition="fade" -->

# before

<img src="/image/original/cat.jpg" class="r-stretch" />

---

<!-- .element data-transition="fade" -->

# after

<img src="/image/preview/pencil_cat.png" class="r-stretch" />

---

# step.1 - 全体的に明るくする

```glsl
vec3 brightenColor = pow(prevColor, vec3(uPencilGamma));
```

- ガンマ補正でコントラスト調整
- ガンマ係数`uPencilGamma`を調整することで、鉛筆の薄さを調整できる

Note:

まずはコントラストを調整し、全体的に明るくします。

---

# step.2 - エッジを抽出

```glsl
// エッジ抽出
vec3 edgeColor = applyKernelXY(uPrevTex, texelSize, uv, kernelX, kernelY);
// 白黒に
edgeColor = vec3(toMonochrome(edgeColor));
```

Note:

それとは別に、エッジ、つまり輪郭だけを抽出したテクスチャを生成します。

---

## Prewittフィルタ

```glsl
float[9] kernelX = float[](
  -1.0, 0.0, 1.0,
  -1.0, 0.0, 1.0,
  -1.0, 0.0, 1.0
);
float[9] kernelY = float[](
  -1.0, -1.0, -1.0,
  0.0, 0.0, 0.0,
  1.0, 1.0, 1.0
);
```

<img src="/image/ref/edge-detection/prewitt.png" class="r-stretch" />

Note:

エッジ抽出の手法はいろいろありますが、ここでは、明るさが変化している箇所を滑らかに検出でき、ノイズを強調せずに済むプレヴィットフィルタを使っています。

---

# step.3 - エッジの強弱のムラを軽減

```glsl [20|1-9|11-18|21]
float dx = texelSize.x;
float dy = texelSize.y;

float c = hash21(texCoord);
  
vec3 pp = texture(uBrightenTex, c + vec2(dx, dy)).rgb;
vec3 mp = texture(uBrightenTex, c + vec2(-dx, dy)).rgb;
vec3 pm = texture(uBrightenTex, c + vec2(dx, -dy)).rgb;
vec3 mm = texture(uBrightenTex, c + vec2(-dx, -dy)).rgb;

vec3 hatchR = brightenColor + mm;
hatchR -= pp;

vec3 hatchL = brightenColor + mp;
hatchL -= pm;

vec3 sketch = hatchR * hatchL;
sketch = vec3(toMonochrome(sketch));

vec3 finalColor = sketch * edge;
finalColor = vec3(1.0) - finalColor;
```

Note:

そして、明るくした画像を白黒にしたものと、エッジを抽出した画像を乗算合成します。

明るくした画像を白黒にする前に、↪︎近隣のピクセルをランダムに参照して↪︎重ね合わせることで、色の濃い部分を分散させます。
そうすることで、より鉛筆らしい淡さが出せます。↪︎

今はエッジの強い部分が白く、それ以外は黒くなってしまっているので、↪白黒反転させて、エッジのみを黒く残します。

---

# デッサン風から色鉛筆画風へ

Note:

デッサン風画像は白黒なので、ここに色を乗せることを考えていきます。

---

# step.4 - エッジ付近に元画像の色を乗せる

```glsl [1-8|6-8|1,6-8|7|8]
float edgeStrength = (edge.r + edge.g + edge.b) / 3.0;

// デッサン風フィルタの最終色
vec3 finalColor = vec3(1.0) - sketch * edge;

// さらに色を乗せていく
finalColor = mix(finalColor, sprayColor, edgeStrength);
finalColor = mix(finalColor, pastelColor, edgeStrength);
```

Note:

まずは、エッジ付近に色を乗せて、黒鉛筆の線を色鉛筆に近づけます。↪︎

mix関数は、第3引数に割合を指定して、2つの色を混ぜ合わせる関数です。

ここでは、↪︎エッジの強さに応じて、元画像の色を混ぜ込んでいます。↪︎

このとき、そのままの色をただ乗せてしまうと、鉛筆の質感がなくなってしまうので、元画像の色を加工した↪︎sprayColorと↪︎pastelColorを使用しています。

---

## sprayColor - 色むらを演出する

```glsl
vec3 spray(sampler2D tex, vec2 uv, vec2 txSize, float spread, float mixRatio) {
  vec3 originalColor = texture(tex, uv).rgb;
  vec2 noise = clamp_range(hash22(uv), vec2(0.0), texelSize);
  vec2 offset = fract(noise * spread);
  vec3 randomColor = texture(tex, uv + offset).rgb;
  vec3 mixedColor = mix(originalColor, randomColor, mixRatio);
  return mixedColor;
}
```

<img src="/image/preview/spray-blur_leaves.png" class="r-stretch" />

Note:

色鉛筆画は、色の濃淡で輪郭を描くので、周囲のさまざまな色が混ざり合ったような質感があります。

元画像の色を周囲に拡散させることで、色むらを演出したものがsprayColorです。

---

## pastelColor - 淡い色に変換する

```glsl
vec3 toPastel(vec3 color, float strength) {
  vec3 hsv = rgb2hsv(color);
  // 彩度は0% ~ 95%の範囲にする
  hsv.y = clamp(hsv.y, 0.0, 0.95);
  // 明度は85% ~ 95%の範囲にする
  hsv.z = clamp(hsv.z, 0.85, 0.95);
  vec3 rgb = hsv2rgb(hsv);
  // 白に近い色を混ぜる（白への近さはstrengthで調整）
  rgb = overlay(rgb, vec3(strength));
  return rgb;
}
```

Note:

また、色鉛筆らしい淡い色に変換したものが、pastelColorです。

---

<!-- .element data-transition="fade" -->

# before

<img src="/image/original/cat.jpg" class="r-stretch" />

Note:

細かくエッジが存在する画像であれば、

---

<!-- .element data-transition="fade" -->

# after

<img src="/image/preview/pale-color-pencil_cat.png" class="r-stretch" />

Note:

エッジ付近に色を乗せるだけで十分です。

---

<!-- .element data-transition="fade" -->

# エッジがあまりない画像だと…

<img class="r-stretch" src="/image/original/tetra.jpg" />

Note:

しかし、エッジがない広い面がある画像だと…

---

<!-- .element data-transition="fade" -->

# 面の色が反映されない

<img src="/image/preview/pale-color-pencil_tetra.png" class="r-stretch" />

Note:

エッジから遠い部分が白のままになってしまいます。

---

# step.5 - 紙の質感とともに面にも色を乗せる

```glsl [1-5,12|7-8]
// すりガラスっぽくぼかす
float radius = 2.0;
float x = (uv.x * texSize.x) + hash21(uv) * radius * 2.0 - radius;
float y = (uv.y * texSize.y) + hash21(vec2(uv.y, uv.x)) * radius * 2.0 - radius;
vec3 noisedColor = texture(uMainTex, vec2(x, y) / texSize).rgb;

// 白に近い紙の色をランダムに混ぜる
noisedColor = mix(noisedColor, vec3(uPaperColorBright), hash21(uv));

// ...省略

finalColor *= toPastel(noisedColor, uAreaContrast);
```

Note:

そこで、全体にも色を乗算合成します。↪︎

ベタ塗りではなく、紙の色を若干残すように、ランダムで白に近い色を混ぜます。

---

<!-- .element data-transition="fade" -->

# こんな感じに

<img src="/image/preview/color-pencil_tetra.png" class="r-stretch" />

Note:

こんな感じになりました。

---

# ステンドグラス風

Note:

続いて、ステンドグラス風のフィルタです。

---

<!-- .element data-transition="fade" -->

# before

<img src="/image/original/autumn-leaves_00037.jpg" class="r-stretch" />

---

<!-- .element data-transition="fade" -->

# after

<img src="/image/preview/standglass_leaves.png" class="r-stretch" />

---

# step.1 - シェーダ側でボロノイ図を生成

```glsl
vec2 tileUv = uv;
tileUv.x *= aspect;
tileUv *= uVoronoiSiteCount;
vec2 voronoi = voronoi2(tileUv);
```

Note:

拡大した座標をタイル分割することでボロノイ図を計算し、同じ領域に属する点は同じ色で塗られるようなテクスチャを2パターン生成します。

---

<!-- .element data-transition="fade" -->

## 青みがかったボロノイ図

<img src="/image/step/standglass/random-blue-voronoi.png" class="r-stretch" />

```glsl
// ボロノイ領域の色をランダムに求めたもの
vec3 voronoiRandomColor = vec3(voronoi, 1.0);
```

Note:

1つ目は完全に元画像とは無関係なランダムな色で塗ったボロノイ図です。

ガラスの色に使うため、青成分に最大値1.0を指定することで青みがかったものにします。

---

<!-- .element data-transition="fade" -->

## 画像上の色を使ったボロノイ図

<img src="/image/step/standglass/random-image-voronoi.png" class="r-stretch" />

```glsl
// 母点位置の元画像の色をボロノイ領域の色としたもの
vec3 vonoroiImageColor = texture(uPrevTex, voronoi).rgb;
```

Note:

2つ目は画像上に存在する色を使って塗ったボロノイ図です。

ただし、ボロノイ図を生成する段階で座標を拡大してしまっているので、位置通りの色にはなっていません。

---

# step.2 - ボロノイの境界線を描画

```glsl [1-2|1|4-11|4|6-7,9-11]
vec3 edge = roberts(uRandomVoronoiTex, uv, texSize).rgb;
float edgeStrength = (edge.r + edge.g + edge.b) / 3.0;

float whiteRatio = dot(prevColor, vec3(1.0));
  
vec3 borderColor = prevColor * 0.3;
borderColor = mix(vec3(0.0), borderColor, whiteRatio);

vec3 areaColor = mix(imageVoronoiColor, prevColor,
  whiteRatio * uVoronoiMixRatio
);
```

Note:

次に、ボロノイテクスチャのエッジを抽出し、ステンドグラスの各ガラスの境界線を描きます。↪︎
今回は繊細な線を抽出できるロバーツフィルタを採用します。↪︎

元画像の白い部分にボロノイが乗ってしまうと汚くなってしまうので、↪︎内積によって元画像の色と白の近さを求め、↪︎白に近い場所ほどボロノイが薄くなるようにしています。

---

<!-- .element data-transition="fade" -->

```glsl
float threshold = uShowVoronoiBorder ? 0.01 : 1.0;

vec3 glassColor = mix(borderColor, areaColor,
  1.0 - step(threshold, edgeStrength)
);
```

<img src="/image/step/standglass/before-overlay-random.png" class="r-stretch" />

Note:

仕組みは割愛しますが、mix関数とstep関数を組み合わせて使うことで、エッジであれば線を描き、そうでなければ領域の色で塗るように条件分岐しています。

その結果がこの画像ですが、ステンドグラスの各ガラスは、もう少し深い色になっているので、

---

<!-- .element data-transition="fade" -->

# step.3 - ガラスの深い色味を表現

```glsl [1|2]
vec3 darken = mix(vec3(0.0), randomVoronoiColor, uRandomMixRatio);
glassColor = overlay(glassColor, darken);
```

<img src="/image/step/standglass/before-add-glow.png" class="r-stretch" />

Note:

ランダムな色のボロノイを少し暗めにしたものを、↪︎overlayブレンドモードで合成します。

ランダムな色のボロノイが、光の当たり方によって異なる色に見える各ガラスを擬似的に表現します。

そして最後に、

---

<!-- .element data-transition="fade" -->

# step.4 - 外から射し込む光を演出

```glsl [1-2|1|2]
vec3 blurred = smooth3x3(uImageVoronoiTex, txSize, uv);
glassColor += blurred * uGlowScale;
```

<img src="/image/preview/standglass_leaves.png" class="r-stretch" />

Note:

ガラスの外から射し込む光を加えます。↪︎

画像の色を使ったボロノイ図を少しだけぼかし、↪︎任意の係数をかけ合わせた上で加算合成します。

加算合成をすると全体が明るくなるので、この操作によりガラスの外から射し込む光を演出することができます。

---

# step.3で逆に明るくすると…

```glsl
vec3 brighten = mix(vec3(1.0), randomVoronoiColor, uRandomMixRatio);
glassColor *= brighten;
```

<img src="/image/preview/standglass-light_leaves.png" class="r-stretch" />

Note:

ガラスの深い色味を表現するstep.3のコードを少し変えると、逆に明るいステンドグラスを作ることもできます。

---

# モザイク

Note:

最後に、モザイク加工を簡単に紹介します。

---

# 拡大時の補間を利用したモザイク

```js
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
```

1. 画像を縮小してフレームバッファに描画
2. 最近傍補間（Nearest neighbor）で拡大して再描画

<img src="/image/preview/mosaic_gold-fish.png" class="r-stretch" />

Note:

本来、モザイクは近隣ピクセルの色を取得し、その平均色を出力することで実現されますが、非常に重い処理になってしまいます。

一旦画像を縮小して書き出し、それをニアレストネイバー法で拡大するだけで、簡単にモザイク画像がつくれます。

---

# ボロノイによるモザイク

1. 無数の円錐を描画（WebGL2のInstancingで）
2. 円錐のトンガリの方向から眺めるように投影
3. 重なり合った円錐同士の境界線がボロノイっぽく見える

<img src="/image/preview/voronoi_unicorn.png" class="r-stretch" />

Note:

円錐を利用してボロノイを生成することもできます。

円錐を使う方法では、元画像の各位置の色をそのまま使って領域を塗りつぶすことができるので、モザイクのような仕上がりになります。

しかし、円錐の数だけバッファを確保してしまっているので、ボロノイの細かさを気軽に変えられないのが難点です。

---

# fin

Note:

