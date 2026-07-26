import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('artifacts/share-brasil-pwa/src');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // remove the exact injected string
  content = content.replace("import { useState, useEffect, useContext, createContext, ReactNode } from 'react';\n", "");
  
  // if 'cn' is used but not imported
  if (content.includes('cn(') && !content.includes("import { cn }")) {
    content = "import { cn } from '@/lib/utils';\n" + content;
  }
  
  // if there's no import React but react hooks are used
  let reactImports = new Set();
  ['useState', 'useEffect', 'useContext', 'createContext', 'ReactNode', 'useRef', 'useCallback'].forEach(hook => {
    if (content.includes(hook) && !content.includes(`import { ${hook}`)) {
      reactImports.add(hook);
    }
  });
  
  if (reactImports.size > 0 && !content.includes("from 'react'")) {
    content = `import { ${Array.from(reactImports).join(', ')} } from 'react';\n` + content;
  }
  
  fs.writeFileSync(file, content);
});
