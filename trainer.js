const fs = require('fs');

// قراءة الأسئلة
const questionsFile = 'questions_batch1.json';
if (!fs.existsSync(questionsFile)) {
  console.error(`❌ خطأ: الملف ${questionsFile} غير موجود!`);
  process.exit(1);
}

const questions = JSON.parse(fs.readFileSync(questionsFile, 'utf8'));
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;

// بيانات Cloudflare
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const KV_NAMESPACE_ID = process.env.KV_NAMESPACE_ID;

if (!DEEPSEEK_KEY) {
  console.error(`❌ خطأ: DEEPSEEK_API_KEY غير موجود!`);
  process.exit(1);
}

if (!CF_ACCOUNT_ID || !CF_API_TOKEN || !KV_NAMESPACE_ID) {
  console.error(`❌ خطأ: بيانات Cloudflare غير مكتملة!`);
  process.exit(1);
}

console.log(`🚀 بدء معالجة ${questions.length} سؤال`);

// دالة لحفظ الجواب في Cloudflare KV
async function saveToKV(key, value) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/${key}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(value)
  });
  
  if (!response.ok) {
    throw new Error(`فشل الحفظ في KV: ${response.statusText}`);
  }
  return true;
}

async function processAll() {
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const questionId = q.id || `q_${i+1}`;
    console.log(`[${i+1}/${questions.length}] معالجة: ${questionId}`);
    
    try {
      // استدعاء DeepSeek API
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { 
              role: 'system', 
              content: 'أنت خبير هندسة متقدم جداً. أجب بالعربية مع شرح وافي وكود كامل إن أمكن.' 
            },
            { role: 'user', content: q.question }
          ],
          temperature: 0.7,
          max_tokens: 4000
        })
      });
      
      const data = await response.json();
      const answer = data.choices[0].message.content;
      
      // تحضير البيانات بنفس صيغة الكود القديم
      const conversationId = `${questionId}_${Date.now()}`;
      const conversation = {
        id: conversationId,
        timestamp: new Date().toISOString(),
        messages: [
          { role: 'user', content: q.question },
          { role: 'assistant', content: answer }
        ]
      };
      
      // حفظ في Cloudflare KV
      const kvKey = `training/${conversationId}.json`;
      await saveToKV(kvKey, conversation);
      
      // أيضاً تحديث قائمة التدريب (training_list)
      console.log(`✅ تم حفظ: ${questionId}`);
      successCount++;
      
    } catch (err) {
      console.log(`❌ فشل: ${questionId} - ${err.message}`);
      failCount++;
    }
    
    // انتظر 2 ثانية بين كل سؤال
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log(`\n🎉 اكتملت المعالجة!`);
  console.log(`📊 نجاح: ${successCount}, فشل: ${failCount}`);
}

processAll();
