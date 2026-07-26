const fs = require('fs');
const glob = require('glob');

const files = glob.sync('artifacts/share-brasil-pwa/src/**/*.{tsx,ts}');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let imports = [];
  if (content.includes('useState')) imports.push('useState');
  if (content.includes('useEffect')) imports.push('useEffect');
  if (content.includes('useContext')) imports.push('useContext');
  if (content.includes('createContext')) imports.push('createContext');
  if (content.includes('useRef')) imports.push('useRef');
  if (content.includes('ReactNode')) imports.push('ReactNode');
  
  if (imports.length > 0) {
    content = `import { ${imports.join(', ')} } from 'react';\n` + content;
    fs.writeFileSync(file, content);
  }
});
