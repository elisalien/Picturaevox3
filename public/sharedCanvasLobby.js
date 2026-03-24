// public/sharedCanvasLobby.js — Shared canvas visible behind game lobby
(function() {
  const bgDiv = document.getElementById('shared-canvas-bg');
  const container = document.getElementById('shared-canvas-container');
  const toggleBtn = document.getElementById('lobby-draw-toggle');
  const toolbar = document.getElementById('lobby-draw-toolbar');

  if (!bgDiv || !container || !window.socket) return;

  const socket = window.socket;

  // Create Konva stage
  const stage = new Konva.Stage({
    container: 'shared-canvas-container',
    width: window.innerWidth,
    height: window.innerHeight
  });
  const layer = new Konva.Layer();
  stage.add(layer);

  const connectionManager = new ConnectionManager(socket);
  const brushManager = new BrushManager(layer, socket);

  // Resize
  window.addEventListener('resize', () => {
    stage.width(window.innerWidth);
    stage.height(window.innerHeight);
    stage.batchDraw();
  });

  // === Drawing state ===
  let drawingActive = false;
  let isDrawing = false;
  let lastLine = null;
  let currentId = null;
  let lobbyColor = '#FFFFFF';
  let lobbySize = 4;

  function generateId() {
    return 'shape_' + Date.now() + '_' + Math.round(Math.random() * 10000);
  }

  function throttle(fn, wait) {
    let last = 0;
    return function(...args) {
      const now = Date.now();
      if (now - last >= wait) { last = now; fn.apply(this, args); }
    };
  }

  const emitDrawing = throttle((data) => {
    connectionManager.emit('drawing', data);
  }, 50);

  // === Toggle drawing mode ===
  toggleBtn.addEventListener('click', () => {
    drawingActive = !drawingActive;
    bgDiv.classList.toggle('drawing-active', drawingActive);
    toggleBtn.classList.toggle('active', drawingActive);
    toggleBtn.textContent = drawingActive ? 'Retour au lobby' : 'Dessiner sur la toile';
    toolbar.classList.toggle('visible', drawingActive);
  });

  // Color selection
  toolbar.querySelectorAll('.ldt-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      toolbar.querySelectorAll('.ldt-dot').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
      lobbyColor = dot.dataset.color;
    });
  });

  // Prevent browser zoom on canvas when drawing
  container.addEventListener('touchstart', (e) => {
    if (drawingActive) e.preventDefault();
  }, { passive: false });
  container.addEventListener('touchmove', (e) => {
    if (drawingActive) e.preventDefault();
  }, { passive: false });

  // === Drawing events ===
  stage.on('mousedown touchstart pointerdown', (evt) => {
    if (!drawingActive) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    isDrawing = true;
    currentId = generateId();

    lastLine = new Konva.Line({
      id: currentId,
      points: [pointer.x, pointer.y],
      stroke: lobbyColor,
      strokeWidth: lobbySize,
      globalCompositeOperation: 'source-over',
      lineCap: 'round',
      lineJoin: 'round'
    });
    layer.add(lastLine);

    emitDrawing({
      id: currentId,
      points: [pointer.x, pointer.y],
      stroke: lobbyColor,
      strokeWidth: lobbySize,
      globalCompositeOperation: 'source-over'
    });
  });

  stage.on('mousemove touchmove pointermove', (evt) => {
    if (!drawingActive || !isDrawing || !lastLine) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    lastLine.points(lastLine.points().concat([pointer.x, pointer.y]));
    layer.batchDraw();

    emitDrawing({
      id: currentId,
      points: lastLine.points(),
      stroke: lastLine.stroke(),
      strokeWidth: lastLine.strokeWidth(),
      globalCompositeOperation: lastLine.globalCompositeOperation()
    });
  });

  stage.on('mouseup touchend pointerup', () => {
    if (!isDrawing || !lastLine) return;
    isDrawing = false;

    connectionManager.emit('draw', {
      id: currentId,
      points: lastLine.points(),
      stroke: lastLine.stroke(),
      strokeWidth: lastLine.strokeWidth(),
      globalCompositeOperation: lastLine.globalCompositeOperation()
    });
  });

  // === Receive shared canvas events ===
  socket.on('initShapes', (shapes) => {
    shapes.forEach(data => {
      if (data.type === 'permanentTrace') {
        let element;
        switch (data.shapeType) {
          case 'Star':    element = new Konva.Star(data.attrs); break;
          case 'Circle':  element = new Konva.Circle(data.attrs); break;
          case 'Line':    element = new Konva.Line(data.attrs); break;
          case 'Ellipse': element = new Konva.Ellipse(data.attrs); break;
        }
        if (element) {
          element.id(data.id);
          element.isPermanentTrace = true;
          layer.add(element);
        }
      } else {
        layer.add(new Konva.Line({
          id: data.id, points: data.points, stroke: data.stroke,
          strokeWidth: data.strokeWidth, globalCompositeOperation: data.globalCompositeOperation,
          lineCap: 'round', lineJoin: 'round'
        }));
      }
    });
    layer.draw();
  });

  socket.on('drawing', (data) => {
    let shape = layer.findOne('#' + data.id);
    if (shape) { shape.points(data.points); shape.strokeWidth(data.strokeWidth); }
    else {
      layer.add(new Konva.Line({
        id: data.id, points: data.points, stroke: data.stroke,
        strokeWidth: data.strokeWidth, globalCompositeOperation: data.globalCompositeOperation,
        lineCap: 'round', lineJoin: 'round'
      }));
    }
    layer.batchDraw();
  });

  socket.on('draw', (data) => {
    let shape = layer.findOne('#' + data.id);
    if (shape) {
      shape.points(data.points); shape.stroke(data.stroke);
      shape.strokeWidth(data.strokeWidth); shape.globalCompositeOperation(data.globalCompositeOperation);
    } else {
      layer.add(new Konva.Line({
        id: data.id, points: data.points, stroke: data.stroke,
        strokeWidth: data.strokeWidth, globalCompositeOperation: data.globalCompositeOperation,
        lineCap: 'round', lineJoin: 'round'
      }));
    }
    layer.draw();
  });

  socket.on('brushEffect', (data) => brushManager.createNetworkEffect(data));
  socket.on('cleanupUserEffects', (data) => brushManager.cleanupUserEffects(data.socketId));

  socket.on('texture', (data) => {
    const particleCount = 6;
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * data.size * 1.4;
      const dotSize = 1.2 + Math.random() * (data.size / 2.5);
      const alpha = 0.35 + Math.random() * 0.35;
      if (Math.random() < 0.7) {
        const lineLength = 1 + Math.random() * 2.5;
        const lineAngle = Math.random() * Math.PI * 2;
        layer.add(new Konva.Line({
          points: [data.x + Math.cos(angle)*distance, data.y + Math.sin(angle)*distance,
                   data.x + Math.cos(angle)*distance + Math.cos(lineAngle)*lineLength,
                   data.y + Math.sin(angle)*distance + Math.sin(lineAngle)*lineLength],
          stroke: data.color, strokeWidth: dotSize * 0.8, opacity: alpha,
          lineCap: 'round', lineJoin: 'round', listening: false
        }));
      } else {
        layer.add(new Konva.Circle({
          x: data.x + Math.cos(angle)*distance, y: data.y + Math.sin(angle)*distance,
          radius: dotSize * 0.6, fill: data.color, opacity: alpha * 0.9, listening: false
        }));
      }
    }
    layer.batchDraw();
  });

  socket.on('deleteShape', ({ id }) => {
    const s = layer.findOne('#' + id);
    if (s) { s.destroy(); layer.draw(); }
  });

  socket.on('clearCanvas', () => {
    layer.destroyChildren(); brushManager.clearEverything(); layer.draw();
  });

  socket.on('restoreShapes', (shapes) => {
    layer.destroyChildren(); brushManager.clearEverything();
    shapes.forEach(data => {
      if (data.type === 'permanentTrace') {
        let el;
        switch (data.shapeType) {
          case 'Star': el = new Konva.Star(data.attrs); break;
          case 'Circle': el = new Konva.Circle(data.attrs); break;
          case 'Line': el = new Konva.Line(data.attrs); break;
          case 'Ellipse': el = new Konva.Ellipse(data.attrs); break;
        }
        if (el) { el.id(data.id); el.isPermanentTrace = true; layer.add(el); }
      } else {
        layer.add(new Konva.Line({
          id: data.id, points: data.points, stroke: data.stroke,
          strokeWidth: data.strokeWidth, globalCompositeOperation: data.globalCompositeOperation,
          lineCap: 'round', lineJoin: 'round'
        }));
      }
    });
    layer.draw();
  });

  socket.on('adminResetBrushEffects', () => {
    brushManager.clearAllEffects(); layer.batchDraw();
  });

  // === Hide shared canvas when game starts ===
  function hideSharedCanvas() {
    drawingActive = false;
    bgDiv.classList.remove('drawing-active');
    bgDiv.style.display = 'none';
    toggleBtn.classList.remove('visible');
    toolbar.classList.remove('visible');
  }

  function showSharedCanvas() {
    bgDiv.style.display = '';
    toggleBtn.classList.add('visible');
  }

  // Listen for phase changes from game.js
  socket.on('game:assigned', () => hideSharedCanvas());
  socket.on('devine:youDraw', () => hideSharedCanvas());
  socket.on('devine:guessMode', () => hideSharedCanvas());
  socket.on('telephone:draw', () => hideSharedCanvas());
  socket.on('telephone:word', () => hideSharedCanvas());
  socket.on('theme:started', () => hideSharedCanvas());

  // Show canvas again when back to lobby/mode-select
  socket.on('game:done', () => showSharedCanvas());
  socket.on('game:spectator', () => showSharedCanvas());

  // Show toggle when in lobby
  const lobbyPhase = document.getElementById('lobby-phase');
  const modeSelectPhase = document.getElementById('mode-select-phase');

  const phaseObserver = new MutationObserver(() => {
    const inLobby = lobbyPhase.classList.contains('visible') || lobbyPhase.style.display !== 'none';
    const inModeSelect = modeSelectPhase.style.display !== 'none';
    if (inLobby || inModeSelect) {
      showSharedCanvas();
    }
  });

  phaseObserver.observe(lobbyPhase, { attributes: true, attributeFilter: ['style', 'class'] });
  phaseObserver.observe(modeSelectPhase, { attributes: true, attributeFilter: ['style', 'class'] });

  // Initial state: show toggle
  showSharedCanvas();

  console.log('[SharedCanvasLobby] Loaded');
})();
