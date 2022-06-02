import * as fs from 'fs';
import axios from 'axios';

const CRATE_IO_BASE_URL = 'https://raw.githubusercontent.com/rust-lang/crates.io-index/master';

const http = axios.create();

const getCrate = async (crateName: string, version: string) => {
  let url = '';
  if (crateName.length > 3) {
    const p0 = crateName.substring(0, 2);
    const p1 = crateName.substring(2, 4);

    url = `${CRATE_IO_BASE_URL}/${p0}/${p1}/${crateName}`;
  } else if (crateName.length > 2) {
    const p0 = crateName.substring(0, 1);

    url = `${CRATE_IO_BASE_URL}/3/${p0}/${crateName}`;
  } else if (crateName.length > 1) {
    url = `${CRATE_IO_BASE_URL}/2/${crateName}`;
  } else {
    url = `${CRATE_IO_BASE_URL}/1/${crateName}`;
  }

  const response = await http.get(url).catch((error) => {
    // console.log('Failed to load content from: ', url);
    return null;
  });

  if (response?.data) {
    const lines = response.data.split(/\r?\n/);
    for await (const line of lines) {
      try {
        if (line.length > 0) {
          const obj = JSON.parse(line);
          if (obj.vers === version) {
            return obj;
          }
        }
      } catch (e) {
        //   console.log(e);
        // console.log('Failed to parse line:\n', line);
      }
    }
  }
  return null;
};

const getCrates = async (crateName: string, version: string, fetchChilds = false) => {
  const crates: any[] = [];
  const crate: any = await getCrate(crateName, version);

  if (fetchChilds && crate && crate.deps?.length > 0) {
    let depCrates = await Promise.all(
      crate.deps.map(async (dep: any) => {
        let req = dep.req;

        if (req.startsWith('^') || req.startsWith('~')) {
          req = req.substring(1);
        }

        const childCrate = await getCrate(dep.name, req);
        return childCrate;
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
  let fixedCrates = await Promise.all(
    cratesToFix.map(async (crateToFix: any) => {
      const crates = await getCrates(crateToFix.name, crateToFix.version, crateToFix.fetchChilds);
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
