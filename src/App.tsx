import "./App.css";

import React from "react";

const userToken = "clbh7qi5g0000072udij2begf";
const topic = "draw.volatile";
const lineWidth = 15;
const canvasWidth = 5000;
const canvasHeight = 5000;

interface Point {
  x: number;
  y: number;
}
interface EventPosition {
  clientX: number;
  clientY: number;
}

interface DrawingContext {
  draw2d: CanvasRenderingContext2D | null;
  previous: Point | null;
  color: string;
  broadcast: ((message: Message) => void) | null;
}

interface ClearMessage {
  type: "C";
}

interface LineMessage {
  type: "L";
  color: string;
  from: Point;
  to: Point;
}

type Message = ClearMessage | LineMessage;

function serializeMessage(message: Message): string {
  switch (message.type) {
    case "C":
      return serializeClearMessage(message);
    case "L":
      return serializeLineMessage(message);
  }
}

function serializeClearMessage({ type }: ClearMessage): string {
  return [type].join(" ");
}

function serializeLineMessage({ type, color, from, to }: LineMessage): string {
  return [
    type,
    color,
    from.x.toFixed(1),
    from.y.toFixed(1),
    to.x.toFixed(1),
    to.y.toFixed(1),
  ].join(" ");
}

function isNumeric(input: string): boolean {
  return typeof input == "string" && !isNaN(parseFloat(input));
}
function isHex(input: string): boolean {
  return /^[0-9a-f]{6}$/.test(input);
}

function deserializeMessage(input: string): Message | null {
  switch (input.substring(0, 1)) {
    case "C":
      return deserializeClearMessage(input);
    case "L":
      return deserializeLineMessage(input);
  }
  return null;
}

function deserializeClearMessage(input: string): ClearMessage | null {
  return input === "C" ? { type: "C" } : null;
}

function deserializeLineMessage(input: string): LineMessage | null {
  const parts = input.split(/ /g);
  if (parts.length !== 6) {
    return null;
  }
  const [, color, fromX, fromY, toX, toY] = input.split(/ /g);
  if (
    color.length !== 7 ||
    !isHex(color.substring(1)) ||
    !isNumeric(fromX) ||
    !isNumeric(fromY) ||
    !isNumeric(toX) ||
    !isNumeric(toY)
  ) {
    return null;
  }
  return {
    type: "L",
    color,
    from: { x: +fromX, y: +fromY },
    to: { x: +toX, y: +toY },
  };
}

const context: DrawingContext = {
  draw2d: null,
  previous: null,
  color: "#000000",
  broadcast: null,
};

function startWebSocket() {
  const ws = new WebSocket(
    `wss://y28.yyt.life/websocket/${topic}?token=${userToken}`
  );
  ws.addEventListener("open", () => {
    context.broadcast = (message) => ws.send(serializeMessage(message));
  });
  ws.addEventListener("close", () => (context.broadcast = null));
  ws.addEventListener("message", (event) => {
    try {
      const maybe = deserializeMessage(event.data);
      if (maybe) {
        switch (maybe.type) {
          case "C":
            clearCanvas();
            break;
          case "L":
            drawLine(maybe);
            break;
        }
      }
    } catch (error) {
      console.error({ error, event }, "invalid message");
    }
  });
  return () => ws.close();
}

function clearCanvas() {
  const { draw2d } = context;
  if (!draw2d) {
    return;
  }
  draw2d.fillStyle = "#f1f1f1";
  draw2d.fillRect(0, 0, canvasWidth, canvasHeight);
}

function drawLine({ color, from, to }: LineMessage) {
  const { draw2d } = context;
  if (!draw2d) {
    return;
  }
  draw2d.beginPath();
  draw2d.moveTo(from.x, from.y);
  draw2d.lineTo(to.x, to.y);
  draw2d.lineWidth = lineWidth;
  draw2d.strokeStyle = color;
  draw2d.stroke();
  draw2d.closePath();
}

function App() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    startWebSocket();
  });
  React.useEffect(() => {
    if (canvasRef.current) {
      if (context.draw2d == null) {
        context.draw2d = canvasRef.current.getContext("2d")!;
        clearCanvas();
      }
    } else {
      context.draw2d = null;
    }
    context.previous = null;
  }, [canvasRef.current]);

  function onPressed({ clientX, clientY }: EventPosition) {
    context.previous = { x: clientX, y: clientY };
  }

  function onRelease() {
    context.previous = null;
  }

  function onMove({ clientX, clientY }: EventPosition) {
    const { draw2d, previous, color, broadcast } = context;
    if (!draw2d || !previous) {
      return;
    }
    const to = { x: clientX, y: clientY };
    const message = { type: "L" as const, color, from: previous, to };
    drawLine(message);
    if (broadcast) {
      broadcast(message);
    }
    context.previous = to;
  }

  return (
    <div className="App">
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }}
        onMouseDown={onPressed}
        onTouchStart={(event) => onPressed(event.touches[0])}
        onMouseUp={onRelease}
        onTouchEnd={onRelease}
        onMouseMove={onMove}
        onTouchMove={(event) => onMove(event.touches[0])}
      ></canvas>
      <div className="LeftTop">
        <ColorButton color="#ff0000" />
        <ColorButton color="#0000ff" />
        <ColorButton color="#ffff00" />
        <ColorButton color="#00ff00" />
        <ColorButton color="#ff7f00" />
        <ColorButton color="#000000" />
      </div>
      <div className="RightTop">
        <button onClick={() => context.broadcast?.({ type: "C" })}>
          지우기
        </button>
      </div>
    </div>
  );
}

function ColorButton({ color }: { color: string }) {
  return (
    <button
      style={{ backgroundColor: color }}
      onClick={() => (context.color = color)}
    ></button>
  );
}

export default App;
