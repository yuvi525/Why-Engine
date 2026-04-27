const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    if (f === 'node_modules' || f === '.next' || f === '.git') return;
    const isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

function removeStyleBlocks() {
  const root = process.cwd();
  console.log(`Scanning for <style> blocks in: ${root}`);
  
  walkDir(root, (filePath) => {
    if (!filePath.endsWith('.js') && !filePath.endsWith('.jsx') && !filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return;
    
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // Aggressive regex to match  block
    // It captures multi-line strings inside template literals
    const styleRegex = /<style>\{\s*`[\s\S]*?`\s*\}<\/style>/g;
    
    if (styleRegex.test(content)) {
      content = content.replace(styleRegex, '');
      if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Cleaned inline style from: ${filePath}`);
      }
    }
  });
  console.log('Cleanup complete.');
}

removeStyleBlocks();
