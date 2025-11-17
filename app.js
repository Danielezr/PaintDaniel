(function ($) {
  $(document).ready(function () {
    console.log("✅ Etapa 10 — Curvas Bézier integradas (cuadrática y cúbica).");

    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = 900;
    canvas.height = 600;

    let herramienta = null;
    let isDrawing = false;
    let isResizing = false;
    let isMoving = false;
    let isRotating = false;
    let offsetX = 0, offsetY = 0;
    let startX = 0, startY = 0;
    let figuras = [];
    let figuraSeleccionada = null;
    let handleSeleccionado = null;
    let anguloInicial = 0;
    let anguloActual = 0;

    // === Panel de propiedades (Etapa 9) ===
    let colorTrazo = "#000000";
    let colorRelleno = "#ffffff";
    let grosorLinea = 2;

    $("#colorTrazo").on("input", function () { colorTrazo = $(this).val(); });
    $("#colorRelleno").on("input", function () { colorRelleno = $(this).val(); });
    $("#grosorLinea").on("input", function () { grosorLinea = parseInt($(this).val()); });

    // === Estado para Bézier (Etapa 10) ===
    let puntosQ = [];   // cuadrática: [P0], [C], [P2]
    let puntosC = [];   // cúbica: [P0], [C1], [C2], [P2]
    let previewBezier = false;

    // =============================
    // ==== CLASES DE FIGURAS =====
    // =============================

    class Figura {
      constructor() { this.selected = false; this.angle = 0; }
      draw() {}
      drawHandles() {}
      isInside() { return false; }
      getHandleAt() { return null; }
      move(dx, dy) {}
      rotateTo(angle) { this.angle = angle; }
      getCenter() { return {x:0,y:0}; }
    }

    class Linea extends Figura {
      constructor(x1, y1, x2, y2, color, grosor) {
        super();
        this.x1 = x1; this.y1 = y1;
        this.x2 = x2; this.y2 = y2;
        this.color = color; this.grosor = grosor;
      }
      draw() {
        ctx.save();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.grosor;
        const mx = (this.x1 + this.x2) / 2;
        const my = (this.y1 + this.y2) / 2;
        ctx.translate(mx, my);
        ctx.rotate(this.angle);
        ctx.beginPath();
        ctx.moveTo(this.x1 - mx, this.y1 - my);
        ctx.lineTo(this.x2 - mx, this.y2 - my);
        ctx.stroke();
        ctx.restore();
        if (this.selected) this.drawHandles();
      }
      drawHandles() {
        ctx.fillStyle = "blue";
        ctx.fillRect(this.x1 - 4, this.y1 - 4, 8, 8);
        ctx.fillRect(this.x2 - 4, this.y2 - 4, 8, 8);
      }
      getHandleAt(x, y) {
        if (Math.hypot(x - this.x1, y - this.y1) < 6) return "start";
        if (Math.hypot(x - this.x2, y - this.y2) < 6) return "end";
        return null;
      }
      getCenter() { return { x: (this.x1 + this.x2)/2, y: (this.y1 + this.y2)/2 }; }
      isInside(x, y) {
        const dist = Math.abs((this.y2 - this.y1) * x - (this.x2 - this.x1) * y + this.x2 * this.y1 - this.y2 * this.x1) /
                     Math.hypot(this.y2 - this.y1, this.x2 - this.x1);
        return dist < 6;
      }
      move(dx, dy) { this.x1 += dx; this.y1 += dy; this.x2 += dx; this.y2 += dy; }
    }

    class Rectangulo extends Figura {
      constructor(x, y, w, h, color, grosor, relleno) {
        super();
        this.x = x; this.y = y; this.w = w; this.h = h;
        this.color = color; this.grosor = grosor; this.relleno = relleno;
      }
      draw() {
        const mx = this.x + this.w / 2;
        const my = this.y + this.h / 2;
        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(this.angle);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.grosor;
        ctx.fillStyle = this.relleno;
        ctx.beginPath();
        ctx.rect(-this.w / 2, -this.h / 2, this.w, this.h);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        if (this.selected) this.drawHandles();
      }
      drawHandles() {
        ctx.fillStyle = "blue";
        [[this.x, this.y],[this.x+this.w, this.y],[this.x, this.y+this.h],[this.x+this.w, this.y+this.h]]
          .forEach(([cx, cy]) => ctx.fillRect(cx - 4, cy - 4, 8, 8));
      }
      getHandleAt(x, y) {
        const size = 6, corners = {
          tl:[this.x, this.y], tr:[this.x+this.w, this.y],
          bl:[this.x, this.y+this.h], br:[this.x+this.w, this.y+this.h]
        };
        for (const [name,[cx,cy]] of Object.entries(corners)) {
          if (Math.abs(x - cx) < size && Math.abs(y - cy) < size) return name;
        }
        return null;
      }
      getCenter() { return { x: this.x + this.w/2, y: this.y + this.h/2 }; }
      isInside(x, y) { return x>this.x && x<this.x+this.w && y>this.y && y<this.y+this.h; }
      move(dx, dy) { this.x += dx; this.y += dy; }
    }

    class Circulo extends Figura {
      constructor(x, y, r, color, grosor, relleno) {
        super();
        this.x = x; this.y = y; this.r = r;
        this.color = color; this.grosor = grosor; this.relleno = relleno;
      }
      draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.grosor;
        ctx.fillStyle = this.relleno;
        ctx.beginPath();
        ctx.arc(0, 0, this.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        if (this.selected) this.drawHandles();
      }
      drawHandles() { ctx.fillStyle = "blue"; ctx.fillRect(this.x + this.r - 4, this.y - 4, 8, 8); }
      getHandleAt(x, y) {
        if (Math.abs(x - (this.x + this.r)) < 6 && Math.abs(y - this.y) < 6) return "radius";
        return null;
      }
      getCenter() { return { x: this.x, y: this.y }; }
      isInside(x, y) { return Math.hypot(x - this.x, y - this.y) <= this.r; }
      move(dx, dy) { this.x += dx; this.y += dy; }
    }

    // ===== Bézier cuadrática =====
    class BezierCuadratica extends Figura {
      constructor(x1, y1, cx, cy, x2, y2, color, grosor) {
        super();
        this.x1 = x1; this.y1 = y1;
        this.cx = cx; this.cy = cy;
        this.x2 = x2; this.y2 = y2;
        this.color = color; this.grosor = grosor;
      }
      _center() {
        const minX = Math.min(this.x1, this.cx, this.x2);
        const maxX = Math.max(this.x1, this.cx, this.x2);
        const minY = Math.min(this.y1, this.cy, this.y2);
        const maxY = Math.max(this.y1, this.cy, this.y2);
        return { x: (minX + maxX)/2, y: (minY + maxY)/2 };
      }
      getCenter() { return this._center(); }
      draw() {
        const m = this._center();
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(this.angle);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.grosor;
        ctx.beginPath();
        ctx.moveTo(this.x1 - m.x, this.y1 - m.y);
        ctx.quadraticCurveTo(this.cx - m.x, this.cy - m.y, this.x2 - m.x, this.y2 - m.y);
        ctx.stroke();
        ctx.restore();

        // handles
        if (this.selected) {
          ctx.fillStyle = "blue";
          [[this.x1,this.y1],[this.cx,this.cy],[this.x2,this.y2]]
            .forEach(([px,py]) => ctx.fillRect(px-3, py-3, 6, 6));
        }
      }
      isInside(x, y) {
        // muestreamos puntos y medimos distancia a segmentos consecutivos
        const pts = [];
        for (let t=0; t<=1; t+=0.04) {
          const xt = (1-t)*(1-t)*this.x1 + 2*(1-t)*t*this.cx + t*t*this.x2;
          const yt = (1-t)*(1-t)*this.y1 + 2*(1-t)*t*this.cy + t*t*this.y2;
          pts.push([xt, yt]);
        }
        for (let i=0; i<pts.length-1; i++) {
          const [x1,y1] = pts[i], [x2,y2] = pts[i+1];
          const dist = Math.abs((y2 - y1) * x - (x2 - x1) * y + x2*y1 - y2*x1) / Math.hypot(y2 - y1, x2 - x1);
          if (dist < 6) return true;
        }
        return false;
      }
      move(dx, dy) { this.x1+=dx; this.y1+=dy; this.cx+=dx; this.cy+=dy; this.x2+=dx; this.y2+=dy; }
    }

    // ===== Bézier cúbica =====
    class BezierCubica extends Figura {
      constructor(x1, y1, c1x, c1y, c2x, c2y, x2, y2, color, grosor) {
        super();
        this.x1=x1; this.y1=y1; this.c1x=c1x; this.c1y=c1y;
        this.c2x=c2x; this.c2y=c2y; this.x2=x2; this.y2=y2;
        this.color=color; this.grosor=grosor;
      }
      _center() {
        const minX = Math.min(this.x1, this.c1x, this.c2x, this.x2);
        const maxX = Math.max(this.x1, this.c1x, this.c2x, this.x2);
        const minY = Math.min(this.y1, this.c1y, this.c2y, this.y2);
        const maxY = Math.max(this.y1, this.c1y, this.c2y, this.y2);
        return { x: (minX + maxX)/2, y: (minY + maxY)/2 };
      }
      getCenter() { return this._center(); }
      draw() {
        const m = this._center();
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(this.angle);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.grosor;
        ctx.beginPath();
        ctx.moveTo(this.x1 - m.x, this.y1 - m.y);
        ctx.bezierCurveTo(
          this.c1x - m.x, this.c1y - m.y,
          this.c2x - m.x, this.c2y - m.y,
          this.x2 - m.x, this.y2 - m.y
        );
        ctx.stroke();
        ctx.restore();

        if (this.selected) {
          ctx.fillStyle = "blue";
          [[this.x1,this.y1],[this.c1x,this.c1y],[this.c2x,this.c2y],[this.x2,this.y2]]
            .forEach(([px,py]) => ctx.fillRect(px-3, py-3, 6, 6));
        }
      }
      isInside(x, y) {
        const pts = [];
        for (let t=0; t<=1; t+=0.04) {
          const xt = Math.pow(1-t,3)*this.x1 + 3*Math.pow(1-t,2)*t*this.c1x + 3*(1-t)*t*t*this.c2x + t*t*t*this.x2;
          const yt = Math.pow(1-t,3)*this.y1 + 3*Math.pow(1-t,2)*t*this.c1y + 3*(1-t)*t*t*this.c2y + t*t*t*this.y2;
          pts.push([xt, yt]);
        }
        for (let i=0; i<pts.length-1; i++) {
          const [x1,y1] = pts[i], [x2,y2] = pts[i+1];
          const dist = Math.abs((y2 - y1) * x - (x2 - x1) * y + x2*y1 - y2*x1) / Math.hypot(y2 - y1, x2 - x1);
          if (dist < 6) return true;
        }
        return false;
      }
      move(dx, dy) {
        this.x1+=dx; this.y1+=dy; this.c1x+=dx; this.c1y+=dy;
        this.c2x+=dx; this.c2y+=dy; this.x2+=dx; this.y2+=dy;
      }
    }

    // =============================
    // ======== DIBUJAR TODO =======
    // =============================
    function dibujarTodo() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      figuras.forEach(f => f.draw());

      if (figuraSeleccionada && herramienta === "rotation") {
        const c = figuraSeleccionada.getCenter();
        ctx.strokeStyle = "gray";
        ctx.beginPath();
        ctx.arc(c.x, c.y, 6, 0, Math.PI * 2);
        ctx.stroke();

        if (isRotating) {
          const texto = `${anguloActual.toFixed(0)}°`;
          ctx.font = "bold 14px Helvetica";
          const ancho = ctx.measureText(texto).width + 12;
          const alto = 24;
          const xBox = c.x + 25;
          const yBox = c.y - 35;

          ctx.save();
          ctx.beginPath();
          ctx.fillStyle = "rgba(0,0,0,0.6)";
          ctx.strokeStyle = "rgba(255,255,255,0.3)";
          ctx.lineWidth = 1;
          if (ctx.roundRect) ctx.roundRect(xBox, yBox, ancho, alto, 6); else ctx.rect(xBox, yBox, ancho, alto);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "white";
          ctx.fillText(texto, xBox + 6, yBox + 16);
          ctx.restore();

          ctx.strokeStyle = "rgba(255,255,255,0.6)";
          ctx.beginPath();
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(xBox, yBox + alto / 2);
          ctx.stroke();
        }
      }
    }

    // =============================
    // ========= EVENTOS ===========
    // =============================

    $(".button").click(function () {
      $(".button").removeClass("selected");
      $(this).addClass("selected");
      herramienta = $(this).attr("ref");

      // Reinicia estado de Bézier al cambiar de herramienta
      puntosQ = [];
      puntosC = [];
      previewBezier = false;
    });

    $("#canvas").mousedown(function (e) {
      const x = e.offsetX, y = e.offsetY;
      startX = x; startY = y;

      if (herramienta === "rotation" && figuraSeleccionada) {
        const c = figuraSeleccionada.getCenter();
        const dx = x - c.x, dy = y - c.y;
        anguloInicial = Math.atan2(dy, dx) - figuraSeleccionada.angle;
        isRotating = true;
        return;
      }

      if (herramienta === "scale" && figuraSeleccionada) {
        const handle = figuraSeleccionada.getHandleAt?.(x, y);
        if (handle) {
          handleSeleccionado = handle;
          isResizing = true;
          return;
        }
      }

      if (herramienta === "selection") {
        figuraSeleccionada = null;
        for (let i = figuras.length - 1; i >= 0; i--) {
          if (figuras[i].isInside(x, y)) { figuraSeleccionada = figuras[i]; break; }
        }
        figuras.forEach(f => f.selected = false);
        if (figuraSeleccionada) { figuraSeleccionada.selected = true; isMoving = true; offsetX = x; offsetY = y; }
        dibujarTodo();
        return;
      }

      if (["line", "rect", "circle"].includes(herramienta)) isDrawing = true;
    });

    $("#canvas").mousemove(function (e) {
      const x = e.offsetX, y = e.offsetY;

      if (isRotating && figuraSeleccionada) {
        const c = figuraSeleccionada.getCenter();
        const dx = x - c.x, dy = y - c.y;
        const nuevoAngulo = Math.atan2(dy, dx) - anguloInicial;
        figuraSeleccionada.rotateTo(nuevoAngulo);
        anguloActual = (nuevoAngulo * 180 / Math.PI + 360) % 360;
        dibujarTodo();

        ctx.strokeStyle = "red";
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        return;
      }

      if (isResizing && figuraSeleccionada) {
        if (figuraSeleccionada instanceof Rectangulo) {
          switch (handleSeleccionado) {
            case "br": figuraSeleccionada.w = x - figuraSeleccionada.x; figuraSeleccionada.h = y - figuraSeleccionada.y; break;
            case "tr": figuraSeleccionada.h = figuraSeleccionada.y + figuraSeleccionada.h - y; figuraSeleccionada.y = y; figuraSeleccionada.w = x - figuraSeleccionada.x; break;
            case "bl": figuraSeleccionada.w = figuraSeleccionada.x + figuraSeleccionada.w - x; figuraSeleccionada.x = x; figuraSeleccionada.h = y - figuraSeleccionada.y; break;
            case "tl": figuraSeleccionada.w = figuraSeleccionada.x + figuraSeleccionada.w - x; figuraSeleccionada.h = figuraSeleccionada.y + figuraSeleccionada.h - y; figuraSeleccionada.x = x; figuraSeleccionada.y = y; break;
          }
        } else if (figuraSeleccionada instanceof Circulo) {
          figuraSeleccionada.r = Math.abs(x - figuraSeleccionada.x);
        } else if (figuraSeleccionada instanceof Linea) {
          if (handleSeleccionado === "start") { figuraSeleccionada.x1 = x; figuraSeleccionada.y1 = y; }
          else if (handleSeleccionado === "end") { figuraSeleccionada.x2 = x; figuraSeleccionada.y2 = y; }
        }
        dibujarTodo();
        return;
      }

      if (isMoving && figuraSeleccionada) {
        const dx = x - offsetX; const dy = y - offsetY;
        figuraSeleccionada.move(dx, dy);
        offsetX = x; offsetY = y;
        dibujarTodo();
        return;
      }

      if (isDrawing && ["line", "rect", "circle"].includes(herramienta)) {
        dibujarTodo();
        ctx.setLineDash([5, 3]);
        ctx.strokeStyle = "#555";
        switch (herramienta) {
          case "line": ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(x, y); ctx.stroke(); break;
          case "rect": ctx.strokeRect(startX, startY, x - startX, y - startY); break;
          case "circle": ctx.beginPath(); ctx.arc(startX, startY, Math.hypot(x - startX, y - startY), 0, Math.PI * 2); ctx.stroke(); break;
        }
        ctx.setLineDash([]);
      }

      // === Previsualización Bézier (punteada + curva fantasma) ===
      if (previewBezier) {
        dibujarTodo();

        // Guía punteada
        ctx.setLineDash([5, 3]);
        ctx.strokeStyle = "gray";
        ctx.beginPath();

        if (herramienta === "quadraticCurve") {
          if (puntosQ.length === 1) {
            const p0 = puntosQ[0];
            ctx.moveTo(p0[0], p0[1]); ctx.lineTo(x, y); ctx.stroke();
          } else if (puntosQ.length === 2) {
            const [p0, c] = puntosQ;
            // Control polygon
            ctx.moveTo(p0[0], p0[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(x, y); ctx.stroke();
            // Curva fantasma
            ctx.setLineDash([]);
            ctx.strokeStyle = "#555";
            ctx.beginPath();
            ctx.moveTo(p0[0], p0[1]);
            ctx.quadraticCurveTo(c[0], c[1], x, y);
            ctx.stroke();
          }
        } else if (herramienta === "bezierCurve") {
          if (puntosC.length === 1) {
            const p0 = puntosC[0]; ctx.moveTo(p0[0], p0[1]); ctx.lineTo(x, y); ctx.stroke();
          } else if (puntosC.length === 2) {
            const [p0, c1] = puntosC; ctx.moveTo(p0[0], p0[1]); ctx.lineTo(c1[0], c1[1]); ctx.lineTo(x, y); ctx.stroke();
          } else if (puntosC.length === 3) {
            const [p0, c1, c2] = puntosC;
            ctx.moveTo(p0[0], p0[1]); ctx.lineTo(c1[0], c1[1]); ctx.lineTo(c2[0], c2[1]); ctx.lineTo(x, y); ctx.stroke();
            ctx.setLineDash([]);
            ctx.strokeStyle = "#555";
            ctx.beginPath();
            ctx.moveTo(p0[0], p0[1]);
            ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], x, y);
            ctx.stroke();
          }
        }
        ctx.setLineDash([]);
      }
    });

    $("#canvas").mouseup(function (event) {
      if (isDrawing) {
        const endX = event.offsetX, endY = event.offsetY;
        switch (herramienta) {
          case "line": figuras.push(new Linea(startX, startY, endX, endY, colorTrazo, grosorLinea)); break;
          case "rect": figuras.push(new Rectangulo(startX, startY, endX - startX, endY - startY, colorTrazo, grosorLinea, colorRelleno)); break;
          case "circle": const r = Math.hypot(endX - startX, endY - startY); figuras.push(new Circulo(startX, startY, r, colorTrazo, grosorLinea, colorRelleno)); break;
        }
        dibujarTodo();
      }
      isDrawing = false; isMoving = false; isResizing = false; isRotating = false;
      handleSeleccionado = null; anguloActual = 0;
      dibujarTodo();
    });

    // === Captura de clics para construir Bézier ===
    $("#canvas").click(function (e) {
      const x = e.offsetX, y = e.offsetY;

      if (herramienta === "quadraticCurve") {
        puntosQ.push([x, y]);
        if (puntosQ.length === 3) {
          const [p0, c, p2] = puntosQ;
          figuras.push(new BezierCuadratica(p0[0], p0[1], c[0], c[1], p2[0], p2[1], colorTrazo, grosorLinea));
          puntosQ = []; previewBezier = false; dibujarTodo();
        } else {
          previewBezier = true;
        }
      }

      if (herramienta === "bezierCurve") {
        puntosC.push([x, y]);
        if (puntosC.length === 4) {
          const [p0, c1, c2, p2] = puntosC;
          figuras.push(new BezierCubica(p0[0], p0[1], c1[0], c1[1], c2[0], c2[1], p2[0], p2[1], colorTrazo, grosorLinea));
          puntosC = []; previewBezier = false; dibujarTodo();
        } else {
          previewBezier = true;
        }
      }
    });

    // === utilidades ===
    $("#clearCanvas").click(() => { figuras = []; figuraSeleccionada = null; puntosQ=[]; puntosC=[]; previewBezier=false; dibujarTodo(); });
    $("#exportPNG").click(() => {
      const link = document.createElement("a");
      link.download = "mi_dibujo.png";
      link.href = canvas.toDataURL();
      link.click();
    });
  });
})(jQuery);
