// gameCanvas.js — Picturaevox 3.5 — Module de dessin pour les modes de jeu
class GameCanvas {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.role = options.role || null; // head | torso | legs (Cadavre Exquis only)
    this.mode = options.mode || 'free'; // free | cadavre | telephone | devine | theme
    this.onDraw = options.onDraw || null; // Callback for live drawing stream (Dessine-Devine)
    this.readOnly = options.readOnly || false;

    this.currentColor = '#FFFFFF';
    this.currentSize = 4;
    this.currentTool = 'brush'; // brush | eraser
    this.isDrawing = false;
    this.lastLine = null;
    this.lines = []; // local undo stack

    this.setupCanvas();
    if (this.role) this.drawGuides();
  }

  setupCanvas() {
    const pad = 24;
    const maxW = Math.min(window.innerWidth - pad, 500);
    const canvasH = Math.round(maxW * 0.75);

    this.width = maxW;
    this.height = canvasH;

    this.stage = new Konva.Stage({
      container: this.containerId,
      width: this.width,
      height: this.height
    });

    this.guideLayer = new Konva.Layer({ listening: false });
    this.drawLayer = new Konva.Layer();
    this.stage.add(this.guideLayer);
    this.stage.add(this.drawLayer);

    if (!this.readOnly) {
      this.stage.on('mousedown touchstart', (e) => this.onPointerDown(e));
      this.stage.on('mousemove touchmove', (e) => this.onPointerMove(e));
      this.stage.on('mouseup touchend', () => this.onPointerUp());
    }

    // Style the container
    this.container.style.width = this.width + 'px';
    this.container.style.height = this.height + 'px';
    this.container.style.margin = '0 auto';
    this.container.style.borderRadius = '12px';
    this.container.style.overflow = 'hidden';
    this.container.style.border = '2px solid rgba(107, 91, 255, 0.3)';
    this.container.style.background = '#000';
    this.container.style.cursor = this.readOnly ? 'default' : 'crosshair';
    this.container.style.touchAction = 'none';
  }

  drawGuides() {
    this.guideLayer.destroyChildren();
    const w = this.width;
    const h = this.height;
    const guideColor = 'rgba(255,255,255,0.15)';
    const labelColor = 'rgba(255,255,255,0.3)';
    const fontSize = 11;

    if (this.role === 'head') {
      this.guideLayer.add(new Konva.Line({
        points: [0, h - 1, w, h - 1],
        stroke: guideColor, strokeWidth: 2, dash: [8, 6]
      }));
      this.guideLayer.add(new Konva.Text({
        text: 'cou', x: w - 30, y: h - 18,
        fill: labelColor, fontSize, fontFamily: 'sans-serif'
      }));
      this.guideLayer.add(new Konva.Line({
        points: [w * 0.38, h - 8, w * 0.38, h],
        stroke: guideColor, strokeWidth: 1.5
      }));
      this.guideLayer.add(new Konva.Line({
        points: [w * 0.62, h - 8, w * 0.62, h],
        stroke: guideColor, strokeWidth: 1.5
      }));
    } else if (this.role === 'torso') {
      this.guideLayer.add(new Konva.Line({
        points: [0, 0, w, 0],
        stroke: guideColor, strokeWidth: 2, dash: [8, 6]
      }));
      this.guideLayer.add(new Konva.Text({
        text: 'cou', x: w - 30, y: 4,
        fill: labelColor, fontSize, fontFamily: 'sans-serif'
      }));
      this.guideLayer.add(new Konva.Line({
        points: [w * 0.38, 0, w * 0.38, 8],
        stroke: guideColor, strokeWidth: 1.5
      }));
      this.guideLayer.add(new Konva.Line({
        points: [w * 0.62, 0, w * 0.62, 8],
        stroke: guideColor, strokeWidth: 1.5
      }));
      this.guideLayer.add(new Konva.Line({
        points: [0, h - 1, w, h - 1],
        stroke: guideColor, strokeWidth: 2, dash: [8, 6]
      }));
      this.guideLayer.add(new Konva.Text({
        text: 'taille', x: w - 40, y: h - 18,
        fill: labelColor, fontSize, fontFamily: 'sans-serif'
      }));
      this.guideLayer.add(new Konva.Line({
        points: [w * 0.35, h - 8, w * 0.35, h],
        stroke: guideColor, strokeWidth: 1.5
      }));
      this.guideLayer.add(new Konva.Line({
        points: [w * 0.65, h - 8, w * 0.65, h],
        stroke: guideColor, strokeWidth: 1.5
      }));
    } else if (this.role === 'legs') {
      this.guideLayer.add(new Konva.Line({
        points: [0, 0, w, 0],
        stroke: guideColor, strokeWidth: 2, dash: [8, 6]
      }));
      this.guideLayer.add(new Konva.Text({
        text: 'taille', x: w - 40, y: 4,
        fill: labelColor, fontSize, fontFamily: 'sans-serif'
      }));
      this.guideLayer.add(new Konva.Line({
        points: [w * 0.35, 0, w * 0.35, 8],
        stroke: guideColor, strokeWidth: 1.5
      }));
      this.guideLayer.add(new Konva.Line({
        points: [w * 0.65, 0, w * 0.65, 8],
        stroke: guideColor, strokeWidth: 1.5
      }));
    }

    this.guideLayer.batchDraw();
  }

  onPointerDown(evt) {
    this.isDrawing = true;
    const pos = this.stage.getPointerPosition();
    const compositeOp = this.currentTool === 'eraser' ? 'destination-out' : 'source-over';

    this.lastLine = new Konva.Line({
      points: [pos.x, pos.y],
      stroke: this.currentColor,
      strokeWidth: this.currentSize,
      globalCompositeOperation: compositeOp,
      lineCap: 'round',
      lineJoin: 'round',
      listening: false
    });
    this.drawLayer.add(this.lastLine);
    this.lines.push(this.lastLine);

    if (this.onDraw) {
      this.onDraw({
        points: [pos.x, pos.y],
        strokeWidth: this.currentSize,
        globalCompositeOperation: compositeOp
      });
    }
  }

  onPointerMove(evt) {
    if (!this.isDrawing || !this.lastLine) return;
    const pos = this.stage.getPointerPosition();
    this.lastLine.points(this.lastLine.points().concat([pos.x, pos.y]));
    this.drawLayer.batchDraw();

    if (this.onDraw) {
      this.onDraw({
        points: this.lastLine.points(),
        strokeWidth: this.currentSize,
        globalCompositeOperation: this.lastLine.globalCompositeOperation()
      });
    }
  }

  onPointerUp() {
    this.isDrawing = false;
    this.lastLine = null;
  }

  setColor(color) {
    this.currentColor = color;
    this.currentTool = 'brush';
  }

  setSize(size) {
    this.currentSize = size;
  }

  setTool(tool) {
    this.currentTool = tool;
    this.container.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair';
  }

  undo() {
    if (this.lines.length === 0) return;
    const line = this.lines.pop();
    line.destroy();
    this.drawLayer.batchDraw();
  }

  clear() {
    this.drawLayer.destroyChildren();
    this.lines = [];
    this.drawLayer.batchDraw();
  }

  // Render incoming drawing data (for Dessine-Devine guesser view)
  renderDrawData(data) {
    if (!data || !data.points) return;
    const line = new Konva.Line({
      points: data.points,
      stroke: '#FFFFFF',
      strokeWidth: data.strokeWidth || 4,
      globalCompositeOperation: data.globalCompositeOperation || 'source-over',
      lineCap: 'round',
      lineJoin: 'round',
      listening: false
    });
    this.drawLayer.add(line);
    this.drawLayer.batchDraw();
  }

  exportImage() {
    return this.drawLayer.toDataURL({ pixelRatio: 2 });
  }

  destroy() {
    if (this.stage) {
      this.stage.destroy();
      this.stage = null;
    }
  }
}
