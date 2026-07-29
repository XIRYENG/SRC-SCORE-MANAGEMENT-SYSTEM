
const val = 57.9999999;
console.log('val.toFixed(2):', val.toFixed(2));
console.log('Math.round(val * 100) / 100:', Math.round(val * 100) / 100);
console.log('Math.round(val * 100) / 100.toFixed(2):', (Math.round(val * 100) / 100).toFixed(2));
console.log('Math.round(val * 10000) / 100:', Math.round(val * 10000) / 100);
console.log('Math.round(val * 10000) / 100.toFixed(2):', (Math.round(val * 10000) / 100).toFixed(2));
