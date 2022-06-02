import * as fs from 'fs';
import * as path from 'path';
import { createFixFile } from '../src';

const cratesToFix = [
  {
    name: 'anchor-lang',
    version: '0.18.2',
    fetchChilds: true,
  },
  { name: 'anchor-spl', version: '0.18.2', fetchChilds: false },
  { name: 'anchor-syn', version: '0.18.2', fetchChilds: false },
];

const outputPath = `${__dirname}/../build`;
if (!fs.existsSync(outputPath)) {
  fs.mkdirSync(outputPath);
}

const fixFile = path.join(outputPath, 'Cargo.lock.fix');

createFixFile(cratesToFix, fixFile, 'anchor');
