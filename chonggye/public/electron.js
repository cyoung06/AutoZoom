const { app, BrowserWindow, shell } = require('electron')
const path = require('path');

app.whenReady().then(() => {
  let win = new BrowserWindow({
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
      contextIsolation: false
    }
  })
  console.log(process.env)
  if (process.env.mode === 'dev') {
    win.loadURL('http://localhost:3000')
    win.webContents.openDevTools()
  } else {
    // win.loadURL(`file://${path.join(__dirname, '../build/index.html')}`)
    win.loadFile(`${path.join(__dirname, '../build/index.html')}`)
  }

  win.once('ready-to-show', () => win.show());
  win.on('closed', () => {
    win = null;
  });
})

app.on('window-all-closed', () => {
  app.quit()
})
const { ipcMain } = require('electron')
const Timetable = require('comcigan-parser');
const timetable= new Timetable();
timetable.init({
    cache: 0
});

ipcMain.handle('COMCIGAN_SEARCH', (evt, keyword) => {
    if (keyword === "") return [];
    return timetable.search(keyword).catch(err => []);
})
ipcMain.handle('COMICGAN_GETTIMETABLE', async (evt, code) => {
    timetable.setSchool(code);
    const timeTable = await timetable.getTimetable();
    const classTimes = await timetable.getClassTime();
    return [timeTable, classTimes];
})
const storage = require('electron-json-storage');
ipcMain.handle('SAVE_CONFIG', (evt, key, val) => {
  return new Promise((res, rej) => {
    storage.set(key, val, (err) => {
      if (err) {
        console.log(err);
        res("ERROR")
      } else res("OK")
    })
  });
})
ipcMain.handle('GET_CONFIG', (evt, key) => {
  return new Promise((res, rej) => {
    storage.get(key, (err, data) => {
      if (err) {
        console.log(err);
        res({err: true});
      } else res({data: data});
    })
  });
})
ipcMain.handle('OPEN', (evt, target) => {
  shell.openExternal(target);
})