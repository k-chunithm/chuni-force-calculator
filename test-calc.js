import { calcChuniForce } from './js/calc.js';
import fs from 'fs';

const records = JSON.parse(fs.readFileSync('test-records.json', 'utf8'));
const constMap = JSON.parse(fs.readFileSync('test-constmap.json', 'utf8'));

const result = calcChuniForce(records, constMap);
console.log("best50 img count:", result.best50.filter(x => x.img).length);
console.log("theoryBest50 img count:", result.theoryBest50.filter(x => x.img).length);
