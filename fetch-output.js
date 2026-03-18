const fs = require('fs');
fetch('http://localhost:3000/api/admissions')
  .then(r => r.json())
  .then(d => {
    fs.writeFileSync('output.json', JSON.stringify(d, null, 2));
  });
