const fs = require('fs');
const { createCanvas } = require('canvas');

// Create a valid 50x50 PNG
const smallCanvas = createCanvas(50, 50);
const smallCtx = smallCanvas.getContext('2d');
smallCtx.fillStyle = '#FF6600';
smallCtx.fillRect(0, 0, 50, 50);
smallCtx.fillStyle = '#FFFFFF';
smallCtx.font = '12px Arial';
smallCtx.fillText('50x50', 5, 30);
fs.writeFileSync(__dirname + '/small-50x50-valid.png', smallCanvas.toBuffer('image/png'));
console.log('Created small-50x50-valid.png');

// Create a valid 200x200 PNG
const normalCanvas = createCanvas(200, 200);
const normalCtx = normalCanvas.getContext('2d');
normalCtx.fillStyle = '#0066FF';
normalCtx.fillRect(0, 0, 200, 200);
normalCtx.fillStyle = '#FFFFFF';
normalCtx.font = '24px Arial';
normalCtx.fillText('200x200', 50, 110);
fs.writeFileSync(__dirname + '/normal-200x200-valid.png', normalCanvas.toBuffer('image/png'));
console.log('Created normal-200x200-valid.png');
