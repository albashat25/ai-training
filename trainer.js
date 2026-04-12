const fs = require('fs');

const questions = JSON.parse(fs.readFileSync('questions_batch1.json'));
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;

async function processAll() {
  console.log(`🚀 بدء معالجة ${questions.length} سؤال`);
  
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    console.log(`[${i+1}/${questions.length}] معالجة: ${q.id}`);
    
    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: q.question }],
          max_tokens: 4000
        })
      });
      
      const data = await response.json();
      const answer = data.choices[0].message.content;
      
      if (!fs.existsSync('answers')) fs.mkdirSync('answers');
      fs.writeFileSync(`answers/${q.id}.json`, JSON.stringify({ 
        id: q.id, 
        question: q.question, 
        answer: answer,
        timestamp: new Date().toISOString()
      }, null, 2));
      
      console.log(`✅ تم حفظ: ${q.id}`);
      
    } catch (err) {
      console.log(`❌ فشل: ${q.id} - ${err.message}`);
    }
    
    // انتظر 2 ثانية بين كل سؤال
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log('🎉 اكتملت المعالجة!');
}

processAll();
