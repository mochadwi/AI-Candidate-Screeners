const fs = require('fs');
const pdfParse = require('pdf-parse');

async function testPDFExtraction() {
  try {
    console.log('Testing PDF extraction...');
    
    // Test CV file
    console.log('\n=== Testing CV File ===');
    const cvPath = 'ai-cv-evaluator/uploads/cv_c5ec6acd-83ef-4324-95a4-78a0f340e610.pdf';
    const cvStats = fs.statSync(cvPath);
    console.log(`File: ${cvPath} (${cvStats.size} bytes)`);
    
    const cvBuffer = fs.readFileSync(cvPath);
    console.log(`Buffer size: ${cvBuffer.length} bytes`);
    
    console.log('Starting CV PDF extraction...');
    const cvData = await pdfParse(cvBuffer);
    console.log(`CV extraction successful! Pages: ${cvData.numpages}, Text length: ${cvData.text.length}`);
    console.log(`First 100 chars: ${cvData.text.substring(0, 100)}...`);
    
    // Test Project file
    console.log('\n=== Testing Project File ===');
    const projectPath = 'ai-cv-evaluator/uploads/project_7d5dd7ae-207b-4559-95d5-3ac91bb026bb.pdf';
    const projectStats = fs.statSync(projectPath);
    console.log(`File: ${projectPath} (${projectStats.size} bytes)`);
    
    const projectBuffer = fs.readFileSync(projectPath);
    console.log(`Buffer size: ${projectBuffer.length} bytes`);
    
    console.log('Starting Project PDF extraction...');
    const projectData = await pdfParse(projectBuffer);
    console.log(`Project extraction successful! Pages: ${projectData.numpages}, Text length: ${projectData.text.length}`);
    console.log(`First 100 chars: ${projectData.text.substring(0, 100)}...`);
    
  } catch (error) {
    console.error('❌ PDF extraction failed:', error);
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
  }
}

testPDFExtraction();