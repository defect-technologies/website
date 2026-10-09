/** A made-up bakery's homepage: the kind of site we build, painted for the landing page. */
export const SKETCH_SIZE = { width: 1200, height: 800 };

export const SKETCH_HTML = `<!doctype html><html><head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;600&family=Big+Shoulders:opsz,wght@10..72,800&display=block">
<style>
  body { margin: 0; background: #f4f1ea; }
  #sketch { width: 1200px; height: 800px; background: #fbf6e9; font-family: Geist; color: #23432f; position: relative; overflow: hidden; }
  nav { display: flex; align-items: center; justify-content: space-between; padding: 36px 64px; }
  .logo { font-family: 'Big Shoulders'; font-weight: 800; font-size: 40px; }
  .links { display: flex; gap: 40px; font-size: 20px; font-weight: 600; }
  .hero { display: grid; grid-template-columns: 1.1fr 1fr; gap: 48px; padding: 40px 64px; }
  h1 { font-family: 'Big Shoulders'; font-weight: 800; font-size: 104px; line-height: 0.92; margin: 0 0 28px; }
  p { font-size: 24px; line-height: 1.45; margin: 0 0 40px; max-width: 30ch; color: #3d5a47; }
  .button { display: inline-block; background: #23432f; color: #fbf6e9; font-size: 22px; font-weight: 600; padding: 20px 36px; border-radius: 999px; }
  .loaf { position: relative; height: 470px; border-radius: 28px; background: #f2b632; overflow: hidden; }
  .bread { position: absolute; left: 70px; right: 70px; top: 150px; height: 210px; border-radius: 120px 120px 60px 60px; background: #b4622a; }
  .score { position: absolute; top: 205px; width: 70px; height: 16px; border-radius: 8px; background: #e7a35a; transform: rotate(-24deg); }
  .sun { position: absolute; right: 48px; top: 40px; width: 90px; height: 90px; border-radius: 50%; background: #fbf6e9; }
  .strip { position: absolute; left: 0; right: 0; bottom: 0; height: 64px; background: #23432f; color: #f2b632; display: flex; align-items: center; gap: 56px; padding: 0 64px; font-size: 20px; font-weight: 600; }
</style></head><body>
<div id="sketch">
  <nav><span class="logo">Marigold Bakery</span><span class="links"><span>Menu</span><span>Visit</span><span>Order</span></span></nav>
  <section class="hero">
    <div>
      <h1>Bread worth waking up for</h1>
      <p>Sourdough, rye and morning buns, baked before sunrise on Elm Street.</p>
      <span class="button">Order for pickup</span>
    </div>
    <div class="loaf">
      <div class="sun"></div>
      <div class="bread"></div>
      <div class="score" style="left:150px"></div>
      <div class="score" style="left:280px"></div>
      <div class="score" style="left:410px"></div>
    </div>
  </section>
  <div class="strip"><span>Open daily, 7am</span><span>Fresh loaves at 8</span><span>Elm Street</span></div>
</div>
</body></html>`;
