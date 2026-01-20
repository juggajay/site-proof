const fs = require('fs');

// A valid 50x50 red PNG image (base64 encoded)
// This is a real, renderable PNG file
const small50x50Base64 =
  'iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAIAAACRXR/mAAAA' +
  'GXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAA' +
  'ADtJREFUeNrszgEJAAAMwLDfv3P/6gYEOtWzrqqq6v8CAH4C' +
  'AAAAEAIAQAgAACEAAIQAABACwAADAGXHAUFGJfm0AAAAAElF' +
  'TkSuQmCC';

// A valid 200x200 blue PNG image (base64 encoded)
const normal200x200Base64 =
  'iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAIAAAAiOjnJAAAA' +
  'GXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAA' +
  'AFNJREFUeNrtwTEBAAAAwiD7p7bGDmAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAA8GoYNwABBbvFUQAAAABJ' +
  'RU5ErkJggg==';

// Decode and save
fs.writeFileSync(
  __dirname + '/small-50x50-valid.png',
  Buffer.from(small50x50Base64, 'base64')
);
console.log('Created small-50x50-valid.png (50x50 pixels)');

fs.writeFileSync(
  __dirname + '/normal-200x200-valid.png',
  Buffer.from(normal200x200Base64, 'base64')
);
console.log('Created normal-200x200-valid.png (200x200 pixels)');

// Let's also create a tiny 10x10 image that's clearly below threshold
const tiny10x10Base64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAA' +
  'FklEQVQY02P4z4APMOGTJEYxKoYYBQCHywX/dqXE/wAAAABJ' +
  'RU5ErkJggg==';

fs.writeFileSync(
  __dirname + '/tiny-10x10.png',
  Buffer.from(tiny10x10Base64, 'base64')
);
console.log('Created tiny-10x10.png (10x10 pixels)');
