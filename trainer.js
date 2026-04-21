const fs = require('fs');

const questionsFile = 'questions_batch12.json';
if (!fs.existsSync(questionsFile)) {
  console.error(`❌ خطأ: الملف ${questionsFile} غير موجود!`);
  process.exit(1);
}

let questions;
try {
  questions = JSON.parse(fs.readFileSync(questionsFile, 'utf8'));
  // إذا كان الملف كائن يحتوي على مصفوفة، نأخذ المصفوفة
  if (!Array.isArray(questions) && questions.questions) {
    questions = questions.questions;
  }
} catch (e) {
  console.error("❌ خطأ في تنسيق ملف JSON الأسئلة!");
  process.exit(1);
}

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const KV_NAMESPACE_ID = process.env.KV_NAMESPACE_ID;

console.log(`🔍 فحص البيئة...`);
if (!DEEPSEEK_KEY || !CF_ACCOUNT_ID || !CF_API_TOKEN || !KV_NAMESPACE_ID) {
  console.error(`❌ خطأ: بعض مفاتيح الربط (Secrets) مفقودة!`);
  process.exit(1);
}

console.log(`🚀 بدء معالجة ${questions.length} سؤال لتدريب Nashmi AI`);

async function saveToKV(key, value) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/${key}`;
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'text/plain' // KV يفضل text/plain للقيم المخزنة
    },
    body: typeof value === 'string' ? value : JSON.stringify(value)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Cloudflare Error: ${response.status} - ${error}`);
  }
  return true;
}

async function processAll() {
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const questionId = q.id || `q_${i+1}`;
    console.log(`\n[${i+1}/${questions.length}] جاري تدريب: ${questionId}`);
    
    try {
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
content: 'أنت خبير اردني في جميع المجالات وخبير في الإجابات النموذجية. ضع المعلومة العلمية حجر فوق حجر. أجب بلهجة أردنية مهنية مع الحفاظ على الدقة العلمية. قم بتحليل السؤال كأستاذ علوم محترف واعطِ الحلول العلمية بأدق المصطلحات وبدون اختصار. اشرح جميع الاسءله خطوة بخطوة مع الحفاظ على الدقة والأمانة العلمية. قدم توصياتك النهائية بوضوح.'
  },

  { role: 'user', content: q.question }
],
    temperature: 0.15,        // أقل من 0.2 لدقة أعلى (قانوني/مالي)
    max_tokens: 4096,        // للأجوبة الطويلة (زي ما عندك)
    top_p: 0.1,              // مثل ما عندك، ممتاز
    frequency_penalty: 0.2,  // يقلل التكرار
    presence_penalty: 0.1    // يشجع على طرح أفكار جديدة
  })
});
      
      if (!response.ok) throw new Error(`DeepSeek API Error: ${response.status}`);
      
      const data = await response.json();
      const aiAnswer = data.choices[0].message.content;

      // التنسيق المخصص للتدريب (Fine-tuning format)
      const trainingData = {
        instruction: q.question,
        input: "",
        output: aiAnswer,
        metadata: {
          source: "Nashmi_Training_v1",
          tags: q.tags || [],
          timestamp: new Date().toISOString()
        }
      };
      
      // اسم الملف في الكلاود فلير (نضعه في مجلد training_data ليسهل الوصول إليه)
      const kvKey = `training_data/${questionId}`;
      await saveToKV(kvKey, trainingData);
      
      console.log(`✅ تم الحفظ بنجاح في الكلاود فلير`);
      successCount++;
      
    } catch (err) {
      console.error(`❌ فشل في ${questionId}: ${err.message}`);
      failCount++;
    }
    
    // انتظار بسيط لتجنب الـ Rate Limit
    await new Promise(r => setTimeout(r, 3000));
  }
  
  console.log(`\n--- 📊 ملخص العملية ---`);
  console.log(`✅ نجاح: ${successCount}`);
  console.log(`❌ فشل: ${failCount}`);
}

processAll();
