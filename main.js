document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('schedule-canvas');
  const ctx = canvas.getContext('2d');

  const PRESETS = {
    cyber: {
      frame: '#00f3ff',
      cardBg: 'rgba(15, 23, 42, 0.85)',
      text: '#ffffff',
      accent: '#ff007f',
      bgDraw: drawCyberBackground
    },
    pop: {
      frame: '#ff9900',
      cardBg: 'rgba(255, 255, 255, 0.9)',
      text: '#333333',
      accent: '#eb4c42',
      bgDraw: drawPopBackground
    },
    simple: {
      frame: '#64748b',
      cardBg: 'rgba(30, 41, 59, 0.9)',
      text: '#f8fafc',
      accent: '#38bdf8',
      bgDraw: drawSimpleBackground
    },
    custom: {
      frame: '#00f3ff',
      cardBg: 'rgba(15, 23, 42, 0.85)',
      text: '#ffffff',
      accent: '#ff007f',
      bgDraw: drawCustomBackground
    }
  };

  let charImage = null;
  let customBgImage = null;

  const modeRadios = document.getElementsByName('mode');
  const bgSelect = document.getElementById('bg-select');
  const customBgWrap = document.getElementById('custom-bg-wrap');
  const bgFileInput = document.getElementById('bg-file');
  const charFileInput = document.getElementById('char-file');

  const frameColorInput = document.getElementById('frame-color');
  const cardBgColorInput = document.getElementById('card-bg-color');
  const textColorInput = document.getElementById('text-color');
  const accentColorInput = document.getElementById('accent-color');

  const weeklyInputs = document.getElementById('weekly-inputs');
  const pickupInputs = document.getElementById('pickup-inputs');

  const aspectSelect = document.getElementById('aspect-select');
  const canvasWrapper = document.querySelector('.canvas-wrapper');

  // プリセット・JSON操作用UI要素
  const presetSelect = document.getElementById('preset-select');
  const savePresetBtn = document.getElementById('save-preset-btn');
  const deletePresetBtn = document.getElementById('delete-preset-btn');
  const exportJsonBtn = document.getElementById('export-json-btn');
  const importJsonFile = document.getElementById('import-json-file');

  // 拡大モーダル用要素
  const zoomOpenBtn = document.getElementById('zoom-open-btn');
  const zoomCloseBtn = document.getElementById('zoom-close-btn');
  const zoomModal = document.getElementById('zoom-modal');
  const zoomImg = document.getElementById('zoom-img');

  // 初期フォーム生成
  initInputForms();

  // イベントリスナー設定
  modeRadios.forEach(r => r.addEventListener('change', onModeChange));
  bgSelect.addEventListener('change', onBgChange);
  bgFileInput.addEventListener('change', handleCustomBgUpload);
  charFileInput.addEventListener('change', handleCharUpload);

  // カラーピッカー変更時の再描画
  [frameColorInput, cardBgColorInput, textColorInput, accentColorInput].forEach(input => {
    input.addEventListener('input', render);
  });

  // スライダー ⇄ 数値入力の双方向同期セットアップ
  setupSyncControl('char-scale', 'char-scale-num');
  setupSyncControl('char-offset-x', 'char-offset-x-num');
  setupSyncControl('char-offset-y', 'char-offset-y-num');

  setupSyncControl('bg-scale', 'bg-scale-num');
  setupSyncControl('bg-offset-x', 'bg-offset-x-num');
  setupSyncControl('bg-offset-y', 'bg-offset-y-num');

  aspectSelect.addEventListener('change', () => {
    updateAspect();
    render();
  });

  document.querySelectorAll('input[type="text"]').forEach(input => {
    input.addEventListener('input', render);
  });

  document.getElementById('download-btn').addEventListener('click', downloadImage);

  // --- プリセット管理 & JSON入出力イベント設定 ---
  const PRESETS_STORAGE_KEY = 'schedule_card_presets_v1';
  loadPresetList();

  // プリセット切り替え時
  presetSelect.addEventListener('change', () => {
    const selectedKey = presetSelect.value;
    if (selectedKey === 'default') return;

    const presets = getStoredPresets();
    if (presets[selectedKey]) {
      applyConfig(presets[selectedKey]);
      render();
    }
  });

  // プリセット保存ボタン
  savePresetBtn.addEventListener('click', () => {
    const defaultInputName = presetSelect.value !== 'default' ? presetSelect.value : '';
    const presetName = prompt('保存するプリセット名を入力してください（例: キャラA用、ネオン風）:', defaultInputName);
    if (!presetName) return;

    const config = getCurrentConfig();
    const presets = getStoredPresets();
    presets[presetName] = config;

    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
    loadPresetList(presetName);
    alert(`プリセット「${presetName}」を保存しました！`);
  });

  // プリセット削除ボタン
  deletePresetBtn.addEventListener('click', () => {
    const selectedKey = presetSelect.value;
    if (selectedKey === 'default') {
      alert('デフォルト設定は削除できません。');
      return;
    }

    if (confirm(`プリセット「${selectedKey}」を削除しますか？`)) {
      const presets = getStoredPresets();
      delete presets[selectedKey];
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
      loadPresetList('default');
    }
  });

  // JSONファイル書き出し
  exportJsonBtn.addEventListener('click', () => {
    const config = getCurrentConfig();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `schedule_config_${presetSelect.value}_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  });

  // JSONファイル読み込み
  importJsonFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const config = JSON.parse(event.target.result);
        applyConfig(config);
        render();
        alert('設定ファイルを読み込みました！');
      } catch (err) {
        alert('設定ファイルの読み込みに失敗しました。正しいJSONファイルか確認してください。');
      }
    };
    reader.readAsText(file);
  });

  // 拡大モーダル制御
  zoomOpenBtn.addEventListener('click', () => {
    zoomImg.src = canvas.toDataURL('image/png');
    zoomModal.classList.remove('hidden');
  });

  zoomCloseBtn.addEventListener('click', () => {
    zoomModal.classList.add('hidden');
  });

  zoomModal.addEventListener('click', (e) => {
    if (e.target === zoomModal) {
      zoomModal.classList.add('hidden');
    }
  });

  // 初期設定 ＆ 描画
  updateAspect();
  render();

  // ----------------------------------------------------
  // 設定データの取得と反映用関数群
  // ----------------------------------------------------
  function getCurrentConfig() {
    return {
      aspect: aspectSelect.value,
      bgSelect: bgSelect.value,
      frameColor: frameColorInput.value,
      cardBgColor: cardBgColorInput.value,
      textColor: textColorInput.value,
      accentColor: accentColorInput.value,
      charScale: document.getElementById('char-scale-num')?.value || 100,
      charOffsetX: document.getElementById('char-offset-x-num')?.value || 0,
      charOffsetY: document.getElementById('char-offset-y-num')?.value || 0,
      bgScale: document.getElementById('bg-scale-num')?.value || 100,
      bgOffsetX: document.getElementById('bg-offset-x-num')?.value || 0,
      bgOffsetY: document.getElementById('bg-offset-y-num')?.value || 0,
      mainTitle: document.getElementById('main-title').value,
      subTitle: document.getElementById('sub-title').value,
      footerNote: document.getElementById('footer-note').value
    };
  }

  function applyConfig(config) {
    if (config.aspect) aspectSelect.value = config.aspect;
    if (config.bgSelect) {
      bgSelect.value = config.bgSelect;
      onBgChange();
    }
    if (config.frameColor) frameColorInput.value = config.frameColor;
    if (config.cardBgColor) cardBgColorInput.value = config.cardBgColor;
    if (config.textColor) textColorInput.value = config.textColor;
    if (config.accentColor) accentColorInput.value = config.accentColor;

    if (config.charScale) setSyncValue('char-scale', 'char-scale-num', config.charScale);
    if (config.charOffsetX) setSyncValue('char-offset-x', 'char-offset-x-num', config.charOffsetX);
    if (config.charOffsetY) setSyncValue('char-offset-y', 'char-offset-y-num', config.charOffsetY);

    if (config.bgScale) setSyncValue('bg-scale', 'bg-scale-num', config.bgScale);
    if (config.bgOffsetX) setSyncValue('bg-offset-x', 'bg-offset-x-num', config.bgOffsetX);
    if (config.bgOffsetY) setSyncValue('bg-offset-y', 'bg-offset-y-num', config.bgOffsetY);

    if (config.mainTitle) document.getElementById('main-title').value = config.mainTitle;
    if (config.subTitle) document.getElementById('sub-title').value = config.subTitle;
    if (config.footerNote) document.getElementById('footer-note').value = config.footerNote;

    updateAspect();
  }

  function getStoredPresets() {
    const saved = localStorage.getItem(PRESETS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  }

  function loadPresetList(selectTarget = null) {
    const presets = getStoredPresets();
    presetSelect.innerHTML = '<option value="default">デフォルト設定</option>';

    Object.keys(presets).forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      presetSelect.appendChild(opt);
    });

    if (selectTarget && presets[selectTarget]) {
      presetSelect.value = selectTarget;
    }
  }

  function setSyncValue(sliderId, numId, value) {
    const slider = document.getElementById(sliderId);
    const numInput = document.getElementById(numId);
    if (slider) slider.value = value;
    if (numInput) numInput.value = value;
  }

  // ----------------------------------------------------
  // 双方向同期バインド関数
  // ----------------------------------------------------
  function setupSyncControl(sliderId, numberId) {
    const slider = document.getElementById(sliderId);
    const numInput = document.getElementById(numberId);

    if (!slider || !numInput) return;

    slider.addEventListener('input', () => {
      numInput.value = slider.value;
      render();
    });

    numInput.addEventListener('input', () => {
      let val = parseFloat(numInput.value);
      if (isNaN(val)) return;

      const min = parseFloat(slider.min);
      const max = parseFloat(slider.max);
      if (val >= min && val <= max) {
        slider.value = val;
      }

      render();
    });
  }

  // ----------------------------------------------------
  // アスペクト比同期処理
  // ----------------------------------------------------
  function updateAspect() {
    const val = aspectSelect.value;
    canvasWrapper.className = `canvas-wrapper ratio-${val}`;

    if (val === '16-9') {
      canvas.width = 1280;
      canvas.height = 720;
    } else if (val === '4-5') {
      canvas.width = 1080;
      canvas.height = 1350;
    } else if (val === '1-1') {
      canvas.width = 1080;
      canvas.height = 1080;
    }
  }

  // ----------------------------------------------------
  // フォーム生成 & イベント制御
  // ----------------------------------------------------
  function initInputForms() {
    const days = ['月', '火', '水', '木', '金', '土', '日'];
    const defaultTimes = ['21:00〜', 'お休み', '20:00〜', '21:00〜', '20:00〜', '13:00〜', '19:00〜'];
    const defaultContents = ['雑談配信', '', '参加型マイクラ', '歌枠配信', '新衣装発表会', '昼活ゲーム配信', '定期配信'];

    weeklyInputs.innerHTML = '';
    days.forEach((day, i) => {
      const row = document.createElement('div');
      row.className = 'schedule-input-row';
      row.innerHTML = `
        <span class="day-label">${day}曜日</span>
        <input type="text" class="time-input w-time" value="${defaultTimes[i]}">
        <input type="text" class="content-input w-content" value="${defaultContents[i]}">
      `;
      weeklyInputs.appendChild(row);
    });

    const confirmedDefaults = [
      { date: '10/24 Sat.', time: '21:00〜', content: 'コラボ配信 / ゲスト参加' },
      { date: '10/25 Sun.', time: '19:00〜', content: '新シーズン耐久配信' }
    ];

    const undecidedDefaults = [
      { date: '10/28 水', time: '時間未定', content: '新作ゲーム配信' },
      { date: '日時未定', time: '準備中', content: 'マイクラ肝試し参加決定！' }
    ];

    const confirmedList = document.getElementById('pickup-list-confirmed');
    const undecidedList = document.getElementById('pickup-list-undecided');

    if (confirmedList && undecidedList) {
      confirmedList.innerHTML = '';
      undecidedList.innerHTML = '';

      confirmedDefaults.forEach(item => addPickupRow(confirmedList, item.date, item.time, item.content, false));
      undecidedDefaults.forEach(item => addPickupRow(undecidedList, item.date, item.time, item.content, true));

      document.getElementById('add-confirmed-btn').onclick = () => {
        const existingCount = confirmedList.querySelectorAll('.pickup-row').length;
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + existingCount);

        const month = targetDate.getMonth() + 1;
        const date = targetDate.getDate();
        const dayNames = ['Sun.', 'Mon.', 'Tue.', 'Wed.', 'Thu.', 'Fri.', 'Sat.'];
        const dayName = dayNames[targetDate.getDay()];

        const autoDateStr = `${month}/${date} ${dayName}`;
        const autoTimeStr = '20:00〜';

        addPickupRow(confirmedList, autoDateStr, autoTimeStr, '', false);
        render();
      };

      document.getElementById('add-undecided-btn').onclick = () => {
        addPickupRow(undecidedList, '日時未定', '準備中', '', true);
        render();
      };
    }

    attachInputEvents();
  }

  function addPickupRow(targetContainer, dateVal = '', timeVal = '', contentVal = '', isUndecided = false) {
    const row = document.createElement('div');
    row.className = `schedule-input-row pickup-row ${isUndecided ? 'is-undecided-row' : ''}`;
    row.innerHTML = `
      <input type="text" class="time-input p-date" value="${dateVal}" placeholder="日付/曜日">
      <input type="text" class="time-input p-time" value="${timeVal}" placeholder="時間">
      <input type="text" class="content-input p-content" value="${contentVal}" placeholder="内容">
      <button type="button" class="remove-btn" title="削除">✕</button>
    `;

    row.querySelector('.remove-btn').addEventListener('click', () => {
      row.remove();
      render();
    });

    targetContainer.appendChild(row);
    attachInputEvents();
  }

  function attachInputEvents() {
    document.querySelectorAll('.schedule-input-container input[type="text"]').forEach(input => {
      input.removeEventListener('input', render);
      input.addEventListener('input', render);
    });
  }

  function onModeChange() {
    const selectedMode = getSelectedMode();
    if (selectedMode === 'weekly') {
      weeklyInputs.classList.remove('hidden');
      pickupInputs.classList.add('hidden');
    } else {
      weeklyInputs.classList.add('hidden');
      pickupInputs.classList.remove('hidden');
    }
    render();
  }

  function onBgChange() {
    const val = bgSelect.value;
    if (val === 'custom') {
      customBgWrap.classList.remove('hidden');
    } else {
      customBgWrap.classList.add('hidden');
    }

    const preset = PRESETS[val];
    if (preset) {
      frameColorInput.value = preset.frame;
      textColorInput.value = preset.text;
      accentColorInput.value = preset.accent;
      cardBgColorInput.value = val === 'pop' ? '#ffffff' : (val === 'simple' ? '#1e293b' : '#111827');
    }

    render();
  }

  function handleCharUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        charImage = img;
        render();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  function handleCustomBgUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        customBgImage = img;
        render();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  function getSelectedMode() {
    return Array.from(modeRadios).find(r => r.checked).value;
  }

  // ----------------------------------------------------
  // Canvas メイン描画処理
  // ----------------------------------------------------
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const mode = getSelectedMode();
    const bgKey = bgSelect.value;
    const frameColor = frameColorInput.value;
    const cardBgColor = hexToRgba(cardBgColorInput.value, 0.85);
    const textColor = textColorInput.value;
    const accentColor = accentColorInput.value;

    // 1. 背景
    PRESETS[bgKey].bgDraw(ctx, canvas.width, canvas.height);

    // 2. ヘッダー
    const mainTitle = document.getElementById('main-title').value;
    const subTitle = document.getElementById('sub-title').value;

    ctx.fillStyle = textColor;
    ctx.font = 'bold 42px "Helvetica Neue", sans-serif';
    ctx.fillText(mainTitle, 60, 80);

    ctx.fillStyle = accentColor;
    ctx.font = 'bold 24px "Helvetica Neue", sans-serif';
    ctx.fillText(subTitle, 60, 120);

    // 3. スケジュール枠描画
    if (mode === 'weekly') {
      renderWeeklyLayout(frameColor, cardBgColor, textColor, accentColor);
    } else {
      renderPickupLayout(frameColor, cardBgColor, textColor, accentColor);
    }

    // 4. キャラクター画像
    if (charImage) {
      renderCharacterImage();
    }

    // 5. フッター注記（左下配置）
    const footerNote = document.getElementById('footer-note').value;
    ctx.fillStyle = textColor;
    ctx.font = '18px "Helvetica Neue", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(footerNote, 60, canvas.height - 30);

    // 6. 強制クレジット表記
    const creditText = "Schedule Card Generator by @ricopinchannel";
    ctx.fillStyle = hexToRgba(textColor, 0.45);
    ctx.font = '13px "Helvetica Neue", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(creditText, 60, canvas.height - 12);
  }

  function renderWeeklyLayout(frameColor, cardBgColor, textColor, accentColor) {
    const days = ['月', '火', '水', '木', '金', '土', '日'];
    const times = Array.from(document.querySelectorAll('.w-time')).map(i => i.value);
    const contents = Array.from(document.querySelectorAll('.w-content')).map(i => i.value);

    const startX = 50;
    const startY = 150;
    
    const aspectVal = aspectSelect.value;
    const cardWidth = aspectVal === '16-9' ? canvas.width * 0.62 : canvas.width * 0.88; 

    const availableHeight = canvas.height - startY - 80; 
    const gap = Math.max(8, availableHeight * 0.02);
    const cardHeight = (availableHeight - gap * 6) / 7;

    days.forEach((day, i) => {
      const y = startY + i * (cardHeight + gap);
      drawRoundedRect(ctx, startX, y, cardWidth, cardHeight, 10, cardBgColor, frameColor, 2);

      const isWeekend = day === '土' || day === '日';
      const badgeColor = isWeekend ? accentColor : frameColor;
      
      const radius = Math.min(28, cardHeight * 0.32);
      ctx.beginPath();
      ctx.arc(startX + 40, y + cardHeight / 2, radius, 0, Math.PI * 2);
      ctx.fillStyle = badgeColor;
      ctx.fill();

      const fontSize = Math.max(16, Math.min(32, cardHeight * 0.38));

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${fontSize}px "Helvetica Neue", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(day, startX + 40, y + cardHeight / 2 + fontSize * 0.35);

      ctx.fillStyle = accentColor;
      ctx.font = `bold ${fontSize}px "Helvetica Neue", sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(times[i] || '', startX + 90, y + cardHeight / 2 + fontSize * 0.35);

      ctx.fillStyle = textColor;
      ctx.font = `bold ${fontSize}px "Helvetica Neue", sans-serif`;
      ctx.fillText(contents[i] || '', startX + 240, y + cardHeight / 2 + fontSize * 0.35);
    });
  }

  function renderPickupLayout(frameColor, cardBgColor, textColor, accentColor) {
    const rows = document.querySelectorAll('.pickup-row');
    const count = rows.length;
    if (count === 0) return;

    const startX = 50;
    const startY = 160;
    const maxAreaHeight = canvas.height - 220;
    
    const aspectVal = aspectSelect.value;
    const cardWidth = aspectVal === '16-9' ? canvas.width * 0.62 : canvas.width * 0.88;

    if (count === 1) {
      const row = rows[0];
      const isUndecided = row.classList.contains('is-undecided-row');
      const date = row.querySelector('.p-date').value;
      const time = row.querySelector('.p-time').value;
      const content = row.querySelector('.p-content').value;

      const cardHeight = Math.min(320, maxAreaHeight);
      const y = startY + (maxAreaHeight - cardHeight) / 2;

      const borderCol = isUndecided ? frameColor : frameColor;
      const badgeCol = isUndecided ? frameColor : accentColor;
      const dateCol = isUndecided ? textColor : accentColor;

      drawRoundedRect(ctx, startX, y, cardWidth, cardHeight, 18, cardBgColor, borderCol, isUndecided ? 2 : 3);

      ctx.fillStyle = badgeCol;
      drawRoundedRect(ctx, startX + 30, y + 25, 170, 32, 6, badgeCol, null, 0);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px "Helvetica Neue", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isUndecided ? 'COMING SOON' : 'PICK UP EVENT', startX + 115, y + 46);
      ctx.textAlign = 'left';

      const dateSize = Math.min(42, canvas.width * 0.038);
      const contentSize = Math.min(52, canvas.width * 0.046);

      ctx.fillStyle = dateCol;
      ctx.font = `bold ${dateSize}px "Helvetica Neue", sans-serif`;
      ctx.fillText(`${date}  ${time}`, startX + 30, y + 115);

      ctx.fillStyle = textColor;
      ctx.font = `bold ${contentSize}px "Helvetica Neue", sans-serif`;
      ctx.fillText(content || '', startX + 30, y + 200);
      return;
    }

    let gap = count === 2 ? 24 : 16;
    let cardHeight = (maxAreaHeight - (count - 1) * gap) / count;

    if (count === 2) {
      cardHeight = Math.min(210, cardHeight);
    } else {
      cardHeight = Math.min(140, cardHeight);
    }
    if (cardHeight < 60) cardHeight = 60;

    rows.forEach((row, i) => {
      const isUndecided = row.classList.contains('is-undecided-row');
      const date = row.querySelector('.p-date').value;
      const time = row.querySelector('.p-time').value;
      const content = row.querySelector('.p-content').value;

      const y = startY + i * (cardHeight + gap);

      const currentFrameColor = isUndecided ? hexToRgba(frameColor, 0.5) : frameColor;
      const barColor = isUndecided ? frameColor : accentColor;
      const dateTextColor = isUndecided ? textColor : accentColor;

      drawRoundedRect(ctx, startX, y, cardWidth, cardHeight, 12, cardBgColor, currentFrameColor, isUndecided ? 1.5 : 2.5);

      ctx.fillStyle = barColor;
      ctx.fillRect(startX + 15, y + 12, isUndecided ? 4 : 8, cardHeight - 24);

      const dateFontSize = Math.max(18, Math.min(34, cardHeight * 0.26));
      const contentFontSize = Math.max(20, Math.min(40, cardHeight * 0.32));

      ctx.fillStyle = dateTextColor;
      ctx.font = `bold ${dateFontSize}px "Helvetica Neue", sans-serif`;
      ctx.fillText(`${date}  ${time}`, startX + 32, y + cardHeight * 0.38);

      ctx.fillStyle = textColor;
      ctx.font = `bold ${contentFontSize}px "Helvetica Neue", sans-serif`;
      ctx.fillText(content || '', startX + 32, y + cardHeight * 0.78);
    });
  }

  function renderCharacterImage() {
    const scaleNum = document.getElementById('char-scale-num');
    const offsetXNum = document.getElementById('char-offset-x-num');
    const offsetYNum = document.getElementById('char-offset-y-num');

    const scale = (scaleNum ? parseFloat(scaleNum.value) : 100) / 100;
    const offsetX = offsetXNum ? parseFloat(offsetXNum.value) : 0;
    const offsetY = offsetYNum ? parseFloat(offsetYNum.value) : 0;

    const targetArea = {
      x: canvas.width * 0.63,
      y: canvas.height * 0.12,
      width: canvas.width * 0.32,
      height: canvas.height * 0.78
    };

    const imgWidth = charImage.width;
    const imgHeight = charImage.height;
    const imgRatio = imgWidth / imgHeight;
    const areaRatio = targetArea.width / targetArea.height;

    let drawW, drawH;
    if (imgRatio > areaRatio) {
      drawW = targetArea.width;
      drawH = targetArea.width / imgRatio;
    } else {
      drawH = targetArea.height;
      drawW = targetArea.height * imgRatio;
    }

    drawW *= scale;
    drawH *= scale;

    const drawX = targetArea.x + (targetArea.width - drawW) / 2 + offsetX;
    const drawY = targetArea.y + (targetArea.height - drawH) + offsetY;

    ctx.drawImage(charImage, drawX, drawY, drawW, drawH);
  }

  function drawCyberBackground(ctx, w, h) {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#020617');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(0, 243, 255, 0.08)';
    ctx.lineWidth = 1;
    const step = 40;
    for (let x = 0; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  function drawPopBackground(ctx, w, h) {
    ctx.fillStyle = '#fff7ed';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(251, 146, 60, 0.15)';
    const step = 30;
    for (let x = 0; x < w; x += step) {
      for (let y = 0; y < h; y += step) {
        ctx.beginPath();
        ctx.arc(x + (y % 60 === 0 ? 0 : 15), y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawSimpleBackground(ctx, w, h) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);
  }

  function drawCustomBackground(ctx, w, h) {
    if (!customBgImage) {
      drawSimpleBackground(ctx, w, h);
      return;
    }

    const bgScaleNum = document.getElementById('bg-scale-num');
    const bgOffsetXNum = document.getElementById('bg-offset-x-num');
    const bgOffsetYNum = document.getElementById('bg-offset-y-num');

    const scale = (bgScaleNum ? parseFloat(bgScaleNum.value) : 100) / 100;
    const offsetX = bgOffsetXNum ? parseFloat(bgOffsetXNum.value) : 0;
    const offsetY = bgOffsetYNum ? parseFloat(bgOffsetYNum.value) : 0;

    const imgRatio = customBgImage.width / customBgImage.height;
    const canvasRatio = w / h;

    let baseW, baseH;
    if (imgRatio > canvasRatio) {
      baseH = h;
      baseW = h * imgRatio;
    } else {
      baseW = w;
      baseH = w / imgRatio;
    }

    const finalW = baseW * scale;
    const finalH = baseH * scale;

    const drawX = (w - finalW) / 2 + offsetX;
    const drawY = (h - finalH) / 2 + offsetY;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    ctx.drawImage(customBgImage, drawX, drawY, finalW, finalH);
  }

  function drawRoundedRect(ctx, x, y, width, height, radius, fillStyle, strokeStyle, strokeWidth) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();

    if (fillStyle) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
    if (strokeStyle) {
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = strokeWidth || 1;
      ctx.stroke();
    }
  }

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function downloadImage() {
    const link = document.createElement('a');
    link.download = `schedule_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }
});