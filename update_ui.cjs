const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/bg-gradient-to-r from-\[#1E3A8A\] to-\[#1e40af\] dark:from-\[#FFFFF0\] dark:to-\[#F5F5E6\] text-white dark:text-\[#3A3F47\] hover:shadow-lg hover:shadow-\[#1E3A8A\]\/30 dark:hover:shadow-\[#FFFFF0\]\/20 hover:-translate-y-0\.5 rounded-xl transition-all duration-300 font-semibold border border-transparent/g, 'btn-exquisite rounded-xl h-11');

code = code.replace(/bg-gradient-to-r from-\[#1E3A8A\] to-\[#1e40af\] dark:from-\[#FFFFF0\] dark:to-\[#F5F5E6\] text-white dark:text-\[#2b2d31\] hover:shadow-lg hover:shadow-\[#1E3A8A\]\/30 dark:hover:shadow-\[#FFFFF0\]\/20 hover:-translate-y-0\.5 rounded-xl transition-all duration-300 font-semibold border border-transparent/g, 'btn-exquisite rounded-xl h-11');

code = code.replace(/bg-gradient-to-r from-\[#1E3A8A\] to-\[#1e40af\] dark:from-\[#FFFFF0\] dark:to-\[#F5F5E6\] text-white dark:text-\[#2b2d31\] hover:shadow-lg hover:shadow-\[#1E3A8A\]\/30 dark:hover:shadow-\[#FFFFF0\]\/20 hover:-translate-y-0\.5 rounded-xl h-11 transition-all duration-300 font-semibold border border-transparent/g, 'btn-exquisite rounded-xl h-11');

code = code.replace(/className="w-full bg-transparent text-\[#1E3A8A\] dark:text-\[#FFFFF0\] border border-\[#1E3A8A\]\/30 dark:border-\[#FFFFF0\]\/30 hover:bg-\[#1E3A8A\]\/5 dark:hover:bg-\[#FFFFF0\]\/15 rounded-xl text-xs font-semibold py-5 transition-all duration-300 hover:-translate-y-0.5 shadow-sm"/g, 'className="w-full btn-outline-exquisite rounded-xl text-xs py-5 shadow-sm"');

code = code.replace(/className="absolute right-2 w-10 h-10 rounded-full bg-\[#1E3A8A\] hover:bg-\[#1E3A8A\]\/90 dark:bg-\[#FFFFF0\] dark:hover:bg-\[#FFFFF0\]\/90 disabled:bg-gray-400 dark:disabled:bg-gray-700 text-white dark:text-\[#2b2d31\] shadow-md transition-transform active:scale-95"/g, 'className="absolute right-2 w-10 h-10 rounded-full btn-exquisite shadow-md disabled:opacity-50"');

code = code.replace(/className="w-14 bg-white dark:bg-transparent border-\[#1E3A8A\]\/50 hover:bg-\[#1E3A8A\]\/30 hover:text-\[#1E3A8A\] dark:text-\[#FFFFF0\] rounded-xl h-11 text-\[#1E3A8A\] dark:text-\[#FFFFF0\]"/g, 'className="w-14 rounded-xl h-11 btn-outline-exquisite"');

fs.writeFileSync('src/App.tsx', code);
console.log("Replaced UI classes");
