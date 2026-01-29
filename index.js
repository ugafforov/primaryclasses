import 'dotenv/config';
import { Telegraf, Markup, session } from 'telegraf';
import { initializeApp } from 'firebase/app';
import {
  addDoc,
  collection,
  getDocs,
  getFirestore,
  serverTimestamp,
} from 'firebase/firestore';
import telegrafScenes from 'telegraf/scenes';

const token = process.env.TELEGRAM_BOT_TOKEN;

const { Scenes } = telegrafScenes;

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is not set.');
  process.exit(1);
}

const firebaseConfig = {
  apiKey: 'AIzaSyCJfV6DDuYMnPqV6tQRPy68rHmAajD1roY',
  authDomain: 'primaryclassesbot.firebaseapp.com',
  projectId: 'primaryclassesbot',
  storageBucket: 'primaryclassesbot.firebasestorage.app',
  messagingSenderId: '368397912297',
  appId: '1:368397912297:web:217269346c415afd4e4878',
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const bot = new Telegraf(token);

const roleKeyboard = Markup.keyboard([
  ['🧑‍🏫 Sinf rahbari', '👨‍🏫 Fan o‘qituvchi'],
  ['👩‍💼 Rahbariyat'],
]).resize();

const classMenuKeyboard = Markup.keyboard([
  ['📚 Sinf hisobot topshirish'],
  ['⭐ Haftaning yulduzi'],
  ['⚠️ Muammoli o‘quvchilar'],
  ['📊 Sinf natijasi'],
  ['🔙 Orqaga'],
]).resize();

const teacherMenuKeyboard = Markup.keyboard([
  ['📘 Fan hisobot'],
  ['🔥 Qo‘llangan metod'],
  ['🔙 Orqaga'],
]).resize();

const adminMenuKeyboard = Markup.keyboard([
  ['📊 Umumiy statistika'],
  ['🏆 Reyting'],
  ['📥 Hisobotlar'],
  ['⚙️ Sozlamalar'],
  ['🔙 Orqaga'],
]).resize();

const saveDocument = async (collectionName, payload) => {
  await addDoc(collection(db, collectionName), {
    ...payload,
    createdAt: serverTimestamp(),
  });
};

const getCollectionDocs = async (collectionName) => {
  const snapshot = await getDocs(collection(db, collectionName));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

const classReportScene = new Scenes.WizardScene(
  'class-report',
  async (ctx) => {
    ctx.wizard.state.data = {};
    await ctx.reply('Sinf nomini kiriting:');
    return ctx.wizard.next();
  },
  async (ctx) => {
    ctx.wizard.state.data.className = ctx.message?.text ?? '';
    await ctx.reply('O‘quvchilar sonini kiriting:');
    return ctx.wizard.next();
  },
  async (ctx) => {
    ctx.wizard.state.data.studentCount = Number(ctx.message?.text ?? 0);
    await ctx.reply('Faollik (%) ni kiriting:');
    return ctx.wizard.next();
  },
  async (ctx) => {
    ctx.wizard.state.data.activity = Number(ctx.message?.text ?? 0);
    await ctx.reply('Intizom (%) ni kiriting:');
    return ctx.wizard.next();
  },
  async (ctx) => {
    ctx.wizard.state.data.discipline = Number(ctx.message?.text ?? 0);
    await ctx.reply('Qisqa izoh qoldiring:');
    return ctx.wizard.next();
  },
  async (ctx) => {
    ctx.wizard.state.data.note = ctx.message?.text ?? '';
    await saveDocument('classReports', {
      ...ctx.wizard.state.data,
      role: 'class_teacher',
      chatId: ctx.chat?.id ?? null,
      fromId: ctx.from?.id ?? null,
      username: ctx.from?.username ?? null,
    });
    await ctx.reply('✅ Hisobot qabul qilindi', classMenuKeyboard);
    return ctx.scene.leave();
  }
);

const starScene = new Scenes.WizardScene(
  'star-student',
  async (ctx) => {
    ctx.wizard.state.data = {};
    await ctx.reply('Haftaning yulduzi o‘quvchi ismini kiriting:');
    return ctx.wizard.next();
  },
  async (ctx) => {
    ctx.wizard.state.data.studentName = ctx.message?.text ?? '';
    await ctx.reply('Sababini yozing:');
    return ctx.wizard.next();
  },
  async (ctx) => {
    ctx.wizard.state.data.reason = ctx.message?.text ?? '';
    await saveDocument('stars', {
      ...ctx.wizard.state.data,
      role: 'class_teacher',
      chatId: ctx.chat?.id ?? null,
      fromId: ctx.from?.id ?? null,
      username: ctx.from?.username ?? null,
    });
    await ctx.reply('🌟 Haftaning yulduzi qabul qilindi', classMenuKeyboard);
    return ctx.scene.leave();
  }
);

const problemScene = new Scenes.WizardScene(
  'problem-student',
  async (ctx) => {
    ctx.wizard.state.data = {};
    await ctx.reply('Muammoli o‘quvchi ismini kiriting:');
    return ctx.wizard.next();
  },
  async (ctx) => {
    ctx.wizard.state.data.studentName = ctx.message?.text ?? '';
    await ctx.reply('Muammo turi (bilim / intizom):');
    return ctx.wizard.next();
  },
  async (ctx) => {
    ctx.wizard.state.data.issueType = ctx.message?.text ?? '';
    await ctx.reply('Ko‘rilgan chorani yozing:');
    return ctx.wizard.next();
  },
  async (ctx) => {
    ctx.wizard.state.data.actionTaken = ctx.message?.text ?? '';
    await saveDocument('problemStudents', {
      ...ctx.wizard.state.data,
      role: 'class_teacher',
      chatId: ctx.chat?.id ?? null,
      fromId: ctx.from?.id ?? null,
      username: ctx.from?.username ?? null,
    });
    await ctx.reply('📌 Ma’lumot rahbariyatga yuborildi', classMenuKeyboard);
    return ctx.scene.leave();
  }
);

const subjectReportScene = new Scenes.WizardScene(
  'subject-report',
  async (ctx) => {
    ctx.wizard.state.data = {};
    await ctx.reply('Fan nomini kiriting:');
    return ctx.wizard.next();
  },
  async (ctx) => {
    ctx.wizard.state.data.subjectName = ctx.message?.text ?? '';
    await ctx.reply('Sinfni kiriting:');
    return ctx.wizard.next();
  },
  async (ctx) => {
    ctx.wizard.state.data.className = ctx.message?.text ?? '';
    await ctx.reply('Kirish testi (%) ni kiriting:');
    return ctx.wizard.next();
  },
  async (ctx) => {
    ctx.wizard.state.data.entryTest = Number(ctx.message?.text ?? 0);
    await ctx.reply('Chiqish testi (%) ni kiriting:');
    return ctx.wizard.next();
  },
  async (ctx) => {
    ctx.wizard.state.data.exitTest = Number(ctx.message?.text ?? 0);
    const growth = ctx.wizard.state.data.exitTest - ctx.wizard.state.data.entryTest;
    await saveDocument('subjectReports', {
      ...ctx.wizard.state.data,
      growth,
      role: 'subject_teacher',
      chatId: ctx.chat?.id ?? null,
      fromId: ctx.from?.id ?? null,
      username: ctx.from?.username ?? null,
    });
    await ctx.reply(`📊 Hisobot qabul qilindi\n🚀 O‘sish: ${growth} %`, teacherMenuKeyboard);
    return ctx.scene.leave();
  }
);

const methodScene = new Scenes.WizardScene(
  'method-report',
  async (ctx) => {
    ctx.wizard.state.data = {};
    await ctx.reply('Qo‘llangan metod nomini kiriting:');
    return ctx.wizard.next();
  },
  async (ctx) => {
    ctx.wizard.state.data.methodName = ctx.message?.text ?? '';
    await ctx.reply('Qisqa izoh yozing:');
    return ctx.wizard.next();
  },
  async (ctx) => {
    ctx.wizard.state.data.note = ctx.message?.text ?? '';
    await saveDocument('methods', {
      ...ctx.wizard.state.data,
      role: 'subject_teacher',
      chatId: ctx.chat?.id ?? null,
      fromId: ctx.from?.id ?? null,
      username: ctx.from?.username ?? null,
    });
    await ctx.reply('✅ Metod bazaga saqlandi', teacherMenuKeyboard);
    return ctx.scene.leave();
  }
);

const stage = new Scenes.Stage([
  classReportScene,
  starScene,
  problemScene,
  subjectReportScene,
  methodScene,
]);

bot.use(session());
bot.use(stage.middleware());

const showRoleMenu = async (ctx) => {
  ctx.session.screen = 'role';
  await ctx.reply(
    'Assalomu alaykum!\nTa’lim nazorat botiga xush kelibsiz 👋\nIltimos, rolingizni tanlang:',
    roleKeyboard
  );
};

const showClassMenu = async (ctx) => {
  ctx.session.screen = 'class_menu';
  await ctx.reply(
    'Sinf rahbari bo‘limi tanlandi.\nQuyidagilardan birini tanlang:',
    classMenuKeyboard
  );
};

const showTeacherMenu = async (ctx) => {
  ctx.session.screen = 'teacher_menu';
  await ctx.reply(
    'Fan o‘qituvchi bo‘limi tanlandi.\nQuyidagilardan birini tanlang:',
    teacherMenuKeyboard
  );
};

const showAdminMenu = async (ctx) => {
  ctx.session.screen = 'admin_menu';
  await ctx.reply(
    'Rahbariyat bo‘limi tanlandi.\nQuyidagilardan birini tanlang:',
    adminMenuKeyboard
  );
};

bot.start(async (ctx) => {
  await showRoleMenu(ctx);
});

bot.hears('🧑‍🏫 Sinf rahbari', async (ctx) => {
  ctx.session.role = 'class_teacher';
  await showClassMenu(ctx);
});

bot.hears('👨‍🏫 Fan o‘qituvchi', async (ctx) => {
  ctx.session.role = 'subject_teacher';
  await showTeacherMenu(ctx);
});

bot.hears('👩‍💼 Rahbariyat', async (ctx) => {
  ctx.session.role = 'admin';
  await showAdminMenu(ctx);
});

bot.hears('🔙 Orqaga', async (ctx) => {
  if (ctx.session.screen === 'class_menu' || ctx.session.screen === 'teacher_menu' || ctx.session.screen === 'admin_menu') {
    await showRoleMenu(ctx);
    return;
  }

  await showRoleMenu(ctx);
});

bot.hears('📚 Sinf hisobot topshirish', async (ctx) => {
  await ctx.scene.enter('class-report');
});

bot.hears('⭐ Haftaning yulduzi', async (ctx) => {
  await ctx.scene.enter('star-student');
});

bot.hears('⚠️ Muammoli o‘quvchilar', async (ctx) => {
  await ctx.scene.enter('problem-student');
});

bot.hears('📊 Sinf natijasi', async (ctx) => {
  const reports = await getCollectionDocs('classReports');
  if (reports.length === 0) {
    await ctx.reply('Hali sinf hisobotlari yo‘q.', classMenuKeyboard);
    return;
  }

  const avgActivity =
    reports.reduce((sum, report) => sum + (Number(report.activity) || 0), 0) /
    reports.length;
  const avgDiscipline =
    reports.reduce((sum, report) => sum + (Number(report.discipline) || 0), 0) /
    reports.length;

  await ctx.reply(
    `📊 Sinf natijasi:\nFaollik: ${avgActivity.toFixed(1)} %\nIntizom: ${avgDiscipline.toFixed(
      1
    )} %`,
    classMenuKeyboard
  );
});

bot.hears('📘 Fan hisobot', async (ctx) => {
  await ctx.scene.enter('subject-report');
});

bot.hears('🔥 Qo‘llangan metod', async (ctx) => {
  await ctx.scene.enter('method-report');
});

bot.hears('📊 Umumiy statistika', async (ctx) => {
  const subjectReports = await getCollectionDocs('subjectReports');
  const classReports = await getCollectionDocs('classReports');

  const avgGrowth =
    subjectReports.length === 0
      ? 0
      : subjectReports.reduce((sum, report) => sum + (Number(report.growth) || 0), 0) /
        subjectReports.length;

  const topClass = classReports
    .filter((report) => report.className)
    .sort((a, b) => (Number(b.activity) || 0) - (Number(a.activity) || 0))[0];

  await ctx.reply(
    `📊 Umumiy statistika:\nO‘rtacha o‘sish: ${avgGrowth.toFixed(
      1
    )} %\nEng faol sinf: ${topClass?.className ?? 'Ma’lumot yo‘q'}`,
    adminMenuKeyboard
  );
});

bot.hears('🏆 Reyting', async (ctx) => {
  const classReports = await getCollectionDocs('classReports');
  const subjectReports = await getCollectionDocs('subjectReports');

  const bestClassTeacher = classReports
    .filter((report) => report.username)
    .sort((a, b) => (Number(b.activity) || 0) - (Number(a.activity) || 0))[0];

  const bestSubjectTeacher = subjectReports
    .filter((report) => report.username)
    .sort((a, b) => (Number(b.growth) || 0) - (Number(a.growth) || 0))[0];

  await ctx.reply(
    `🏆 Reyting:\nEng yaxshi sinf rahbari: ${bestClassTeacher?.username ?? 'Ma’lumot yo‘q'}\nEng katta o‘sish ko‘rsatgan fan o‘qituvchi: ${
      bestSubjectTeacher?.username ?? 'Ma’lumot yo‘q'
    }`,
    adminMenuKeyboard
  );
});

bot.hears('📥 Hisobotlar', async (ctx) => {
  const classReports = await getCollectionDocs('classReports');
  const subjectReports = await getCollectionDocs('subjectReports');

  await ctx.reply(
    `📥 Hisobotlar:\nSinf rahbari hisobotlari: ${classReports.length} ta\nFan o‘qituvchi hisobotlari: ${subjectReports.length} ta`,
    adminMenuKeyboard
  );
});

bot.hears('⚙️ Sozlamalar', async (ctx) => {
  await ctx.reply('⚙️ Sozlamalar bo‘limi hozircha tayyor emas.', adminMenuKeyboard);
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
