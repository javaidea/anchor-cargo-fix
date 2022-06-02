import * as fs from 'fs';
import axios from 'axios';
import { exit } from 'process';

const http = axios.create({
  baseURL: 'https://raw.githubusercontent.com/rust-lang/crates.io-index/master',
  timeout: 10000,
});

const getCrate = async (crateName: string, version: string) => {
  let url = '';
  if (crateName.length > 3) {
    const p0 = crateName.substring(0, 2);
    const p1 = crateName.substring(2, 4);

    url = `/${p0}/${p1}/${crateName}`;
  } else if (crateName.length > 2) {
    const p0 = crateName.substring(0, 1);

    url = `/3/${p0}/${crateName}`;
  } else if (crateName.length > 1) {
    url = `/2/${crateName}`;
  } else {
    url = `/1/${crateName}`;
  }

  let response: any;
  let retryCount = 0;
  const retryLimit = 5;
  while (retryCount < retryLimit) {
    try {
      response = await http.get(url);
      if (response.status === 200) {
        break;
      }
    } catch (e) {
      // Ignore here
    }
    retryCount++;
    process.stdout.write('Fetching ' + crateName + ', retry ' + retryCount + '\r');
    if (retryCount === retryLimit) {
      console.log('Failed to load content from:', url);
      exit(-1);
    }
  }

  if (response?.data) {
    const lines = response.data.split(/\r?\n/);
    for await (const line of lines) {
      try {
        if (line.length > 0) {
          const obj = JSON.parse(line);
          if (obj.vers === version) {
            console.log('Process:', obj.name, ', version:', obj.vers);
            return obj;
          }
        }
      } catch (e) {
        console.log('Failed to parse line:\n', line);
      }
    }
  }
  return null;
};

const getCrates = async (crateName: string, version: string, fetchChilds = false, prefix: string | null) => {
  const crates: any[] = [];
  const crate: any = await getCrate(crateName, version);

  if (fetchChilds && crate && crate.deps?.length > 0) {
    let depCrates = await Promise.all(
      crate.deps.map(async (dep: any) => {
        let req = dep.req;

        if (req.startsWith('^') || req.startsWith('~')) {
          req = req.substring(1);
        }
        if (prefix) {
          if (dep.name.startsWith(prefix)) {
            const childCrate = await getCrate(dep.name, req);
            return childCrate;
          }
        } else {
          const childCrate = await getCrate(dep.name, req);
          return childCrate;
        }
      }),
    );

    depCrates = depCrates.filter((depCrate) => depCrate?.name);

    if (depCrates.length > 0) {
      depCrates.forEach((subCrate) => {
        crates.push(subCrate);
      });
    }
  }

  if (crate) {
    crates.push(crate);
  }
  return crates;
};

const createCrate = (crate: any) => {
  let s = '[[package]]\n';
  s += 'name = "' + crate.name + '"\n';
  s += 'version = "' + crate.vers + '"\n';
  s += 'source = "registry+https://github.com/rust-lang/crates.io-index"\n';

  s += 'checksum = "' + crate.cksum + '"\n';
  if (crate.deps?.length > 0) {
    s += 'dependencies = [\n';
    crate.deps.forEach((dep: any) => {
      s += ' "' + dep.name + '",\n';
    });
    s += ']\n\n';
    return s;
  }
};

const createFixedCrates = (crates: any, prefix: string | null) => {
  let buf = '';
  crates.forEach((crate: any) => {
    if (prefix) {
      if (crate.name.startsWith(prefix)) {
        const s = createCrate(crate);
        buf += s;
      }
    } else {
      const s = createCrate(crate);
      buf += s;
    }
  });
  return buf;
};

export const createFixFile = async (cratesToFix: any, fixFile: string, prefix: string | null) => {
  if (fs.existsSync(fixFile)) {
    fs.rmSync(fixFile);
  }
  let fixedCrates = await Promise.all(
    cratesToFix.map(async (crateToFix: any) => {
      const crates = await getCrates(crateToFix.name, crateToFix.version, crateToFix.fetchChilds, prefix);
      return createFixedCrates(crates, prefix);
    }),
  );

  fixedCrates = fixedCrates.filter((buf) => buf);

  let outputBuf = '';
  fixedCrates.forEach((crate) => {
    outputBuf += crate;
  });

  fs.writeFileSync(fixFile, outputBuf);
};
