# anchor-cargo-fix

The purpose of this package is to help generating the needed cargo lock configurations. So far this package will not modify the Cargo.lock file. But it will generate the requested crate configurations and write it in a file you specify.

1. Installation
   npm i cargo-lock-fix -D
   or
   yarn add -D cargo-lock-fix
2. Usage
   Create a script fix-cargo.js. Some sample code can like below:

   ```js
   import { createFixFile } from 'cargo-lock-fix';
   import path, { dirname } from 'path';
   import { fileURLToPath } from 'url';

   const __filename = fileURLToPath(import.meta.url);
   const __dirname = dirname(__filename);

   const cratesToFix = [
     {
       name: 'anchor-lang',
       version: '0.18.2',
       fetchChilds: true,
     },
     { name: 'anchor-spl', version: '0.18.2', fetchChilds: false },
     { name: 'anchor-syn', version: '0.18.2', fetchChilds: false },
   ];

   const fixFile = path.resolve(`${__dirname}/target/Cargo.lock.fix`);

   createFixFile(cratesToFix, fixFile, 'anchor');
   ```

3. Run

   node fix-cargo.js

   If success, a file "Cargo.lock.fix", will be generated. You can copy the needed content to Cargo.lock to replace the crates you want to replace.
