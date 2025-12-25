// main.js

// --- 1. 定数・設定 ---
const COLORS = ['red', 'pink', 'orange', 'yellow', 'green', 'blue', 'purple'];
const COURSE_LENGTH = 32;
const LAPS_TO_WIN = 3;

// v8ユーザー要求 (29: CRUSH, 30: ZONE, 31: GOAL)
const COURSE_MAP = [
    'START', '1UP', '1DOWN', '・', 'CRUSH', '・', '2UP', '2DOWN', // 0-7
    '・', 'ZONE', '・', '1UP', '1DOWN', '・', '3UP', '・', // 8-15
    'CRUSH', '1UP', '2DOWN', '・', '1UP', 'ZONE', '・', '3DOWN', // 16-23
    '・', '2UP', '・', 'CRUSH', '・', 'CRUSH', 'ZONE', 'GOAL' // 24-31
];

// v12 修正：「5」を削除し、「1」「3」「4」を各10枚に変更
const DECK_CONFIG = [
    { type: 'number', value: 1, count: 10 },
    { type: 'number', value: 3, count: 10 },
    { type: 'number', value: 4, count: 10 },
    // { type: 'number', value: 5, count: 8 }, // 削除
    { type: 'color', value: 2, count: 14 }, // 7色 x 2枚
    { type: 'special', effect: 'x2', count: 5 },
    { type: 'special', effect: 'change', count: 4 },
    { type: 'special', effect: 'shuffle', count: 2 }
];

// AIの性格定義
const AI_PERSONALITIES = {
    'RANDOM': 'ランダム',
    'ATTACKER': '1. 猪突猛進な勝負師',
    'SAFE': '2. 用意周到な観測者',
    'CHAOS': '3. 神出鬼没な道化師',
    'BLUFFER': '4. 仮面の戦略家',
    'LOGIC': '5. 冷徹な分析家',
    'OPPORTUNIST': '6. 日和見な漁夫'
};
const AI_PERSONALITY_KEYS = Object.keys(AI_PERSONALITIES).filter(k => k !== 'RANDOM'); // 'RANDOM'を除くキーのリスト

// --- 2. ゲーム状態 (グローバルステート) ---
let gameState = {
    players: [], // { id, hand, assignedColor, revealed, personality }
    npcColors: [],
    deck: [],
    discardPile: [],
    
    bigKomaPosition: 0,
    currentLap: 1,
    currentTurn: 0, // ターン数
    
    rankingBoard: [], // ['red', 'blue', 'green', ...] (1位から順に)
    
    gamePhase: 'setup', // setup, selectCard, resolving, endGame
    
    turnMultiplier: 1,
    
    // 履歴管理用
    history: {
        rankHistory: [], // [{ turn: 1, ranking: ['red', 'blue', ...] }, ...]
        shuffleHistory: [] // [{ turn: 3, player: 'COM 1', oldColor: 'red', newColor: 'blue' }, ...]
    },
    // ターンリザルト (テーブル表示用)
    turnResultHistory: [], // [{ turn, minVal, movers, batting, results[] }, ...]
    currentTurnData: {}    // 現在のターンのデータ
};

// --- 3. DOM要素のキャッシュ (宣言のみ) ---
let setupModal, startGameBtn, playerCountSelect, endGameModal, endGameTitle, endGameResult,
    courseBoardEl, bigKomaEl, rankingBoardEl, playerHandEl, revealAreaEl, logEl,
    lapCounterEl, bigKomaPositionEl, assignedColorDisplayEl, aiStatusEl, turnResultEl,
    homeScreen, homeStartBtn, homeRulesBtn, ruleModal, closeRulesBtn, gameContainer,
    aiSelectionArea; // AI選択エリア


// --- 4. ゲームセットアップ (DOM読み込み後に実行) ---

document.addEventListener('DOMContentLoaded', () => {
    
    // DOMキャッシュ(代入)
    setupModal = document.getElementById('setup-modal');
    startGameBtn = document.getElementById('start-game-btn');
    playerCountSelect = document.getElementById('player-count-select');
    endGameModal = document.getElementById('end-game-modal');
    endGameTitle = document.getElementById('end-game-title');
    endGameResult = document.getElementById('end-game-result');
    courseBoardEl = document.getElementById('course-board');
    bigKomaEl = document.getElementById('big-koma');
    rankingBoardEl = document.getElementById('ranking-board');
    playerHandEl = document.getElementById('player-hand');
    revealAreaEl = document.getElementById('reveal-area');
    logEl = document.getElementById('game-log');
    lapCounterEl = document.getElementById('lap-counter');
    bigKomaPositionEl = document.getElementById('big-koma-position');
    assignedColorDisplayEl = document.getElementById('assigned-color-display');
    aiStatusEl = document.getElementById('ai-status');
    turnResultEl = document.getElementById('turn-result-display');
    homeScreen = document.getElementById('home-screen');
    homeStartBtn = document.getElementById('home-start-btn');
    homeRulesBtn = document.getElementById('home-rules-btn');
    ruleModal = document.getElementById('rule-modal');
    closeRulesBtn = document.getElementById('close-rules-btn');
    gameContainer = document.getElementById('game-container');
    aiSelectionArea = document.getElementById('ai-selection-area');
    
    // 起動エラーチェック
    if (!homeScreen || !startGameBtn || !courseBoardEl || !setupModal || !playerCountSelect || !playerHandEl || !aiSelectionArea) {
        console.error("起動エラー：HTML要素(id)が見つかりません。");
        alert("起動エラー：HTML側で必要なIDが見つかりません。\n(例: 'home-screen', 'ai-selection-area' など)");
        return;
    }

    // コースボードのマスを生成
    COURSE_MAP.forEach((effect, index) => {
        const cell = document.createElement('div');
        cell.classList.add('course-cell');
        cell.dataset.index = index;
        if (effect.includes('UP')) cell.classList.add('cell-UP');
        else if (effect.includes('DOWN')) cell.classList.add('cell-DOWN');
        else if (effect === 'CRUSH') cell.classList.add('cell-CRUSH');
        else if (effect === 'ZONE') cell.classList.add('cell-ZONE');
        else if (effect === 'START') cell.classList.add('cell-START');
        else if (effect === 'GOAL') cell.classList.add('cell-GOAL'); 
        
        cell.innerHTML = `<span class="cell-number">${index}</span>${effect}`;
        courseBoardEl.appendChild(cell);
    });

    // --- イベントリスナー ---
    
    // ホーム画面
    homeStartBtn.addEventListener('click', () => {
        homeScreen.classList.add('hidden');
        setupModal.classList.remove('hidden');
    });
    homeRulesBtn.addEventListener('click', () => {
        ruleModal.classList.remove('hidden');
    });
    closeRulesBtn.addEventListener('click', () => {
        ruleModal.classList.add('hidden');
    });

    // AI選択UIの動的生成
    playerCountSelect.addEventListener('change', updateAiSelectionUI);
    updateAiSelectionUI(); // 初期表示

    // セットアップ画面の「GAME START」ボタン
    startGameBtn.addEventListener('click', () => {
        const playerCount = parseInt(playerCountSelect.value);
        
        // 選択されたAIの性格を取得
        const selectedPersonalities = [];
        const selects = aiSelectionArea.querySelectorAll('.ai-personality-select');
        selects.forEach(select => {
            selectedPersonalities.push(select.value);
        });

        setupModal.classList.add('hidden');
        gameContainer.classList.remove('hidden'); 
        setupGame(playerCount, selectedPersonalities); // AI性格を渡す
    });
    
    // カード選択のイベントリスナー
    playerHandEl.addEventListener('click', (e) => {
        if (gameState.gamePhase !== 'selectCard') return;
        
        const cardEl = e.target.closest('.card');
        if (!cardEl) return;
        
        const cardIndex = parseInt(cardEl.dataset.index);
        const selectedCard = gameState.players[0].hand.splice(cardIndex, 1)[0];
        
        // UIロック
        gameState.gamePhase = 'resolving';
        playerHandEl.innerHTML = '<p>AIの選択を待っています...</p>';
        
        // AIのカード選択
        const aiSelections = selectAiCards();
        
        // 全員の選択を収集
        const allSelections = [
            { playerId: 'player', card: selectedCard },
            ...aiSelections
        ];
        
        // 解決フェーズへ (非同期)
        resolveTurn(allSelections);
    });

}); // DOMContentLoaded 終了

// AI選択UIを更新する関数
function updateAiSelectionUI() {
    const playerCount = parseInt(playerCountSelect.value);
    const aiCount = playerCount - 1;
    aiSelectionArea.innerHTML = ''; // クリア

    for (let i = 0; i < aiCount; i++) {
        const div = document.createElement('div');
        div.classList.add('setup-row');
        
        const label = document.createElement('label');
        label.innerText = `COM ${i + 1}:`; // AI名変更
        
        const select = document.createElement('select');
        select.classList.add('ai-personality-select');
        
        // オプションを追加
        for (const key in AI_PERSONALITIES) {
            const option = document.createElement('option');
            option.value = key;
            option.innerText = AI_PERSONALITIES[key];
            select.appendChild(option);
        }
        
        div.appendChild(label);
        div.appendChild(select);
        aiSelectionArea.appendChild(div);
    }
}

// setupGame が aiPersonalities を受け取る
function setupGame(playerCount, aiPersonalities) {
    logEl.innerHTML = ''; // ログクリア
    turnResultEl.innerHTML = ''; // 結果クリア
    log('ゲームセットアップ中...', 'log-turn');

    // 履歴リセット
    gameState.history = { rankHistory: [], shuffleHistory: [] };
    gameState.turnResultHistory = [];
    gameState.currentTurnData = {};
    gameState.currentTurn = 0; // ターンリセット
    gameState.currentLap = 1;
    gameState.bigKomaPosition = 0;


    // プレイヤーとAIの初期化
    gameState.players = [{ id: 'player', hand: [], assignedColor: null, revealed: false, personality: 'HUMAN' }];
    
    aiPersonalities.forEach((personality, index) => {
        let finalPersonality = personality;
        if (personality === 'RANDOM') {
            // "RANDOM" が選択された場合、定義リストからランダムに選ぶ
            finalPersonality = AI_PERSONALITY_KEYS[Math.floor(Math.random() * AI_PERSONALITY_KEYS.length)];
        }
        gameState.players.push({
            id: `COM ${index + 1}`, // AI名変更
            hand: [],
            assignedColor: null,
            revealed: false,
            personality: finalPersonality // 性格を保存
        });
    });

    // 担当駒の割り当て
    let availableColors = [...COLORS];
    availableColors.sort(() => Math.random() - 0.5); // シャッフル
    
    gameState.players.forEach(player => {
        player.assignedColor = availableColors.pop();
    });
    gameState.npcColors = availableColors; // 残りがNPC

    // 順位ボードの初期化 (ランダム)
    gameState.rankingBoard = [...COLORS].sort(() => Math.random() - 0.5);
    // 履歴：ターン0（初期配置）の順位を保存
    gameState.history.rankHistory.push({ turn: 0, ranking: [...gameState.rankingBoard] });

    // 山札の作成とシャッフル
    gameState.deck = createDeck();
    gameState.discardPile = [];

    // 手札の配布
    gameState.players.forEach(player => {
        drawCards(player, 3);
    });

    // UIの初期描画
    renderAll();
    updateBigKomaPosition();
    
    log(`ゲーム開始！ (全 ${playerCount} 人) あなたの担当は【${gameState.players[0].assignedColor.toUpperCase()}】です。`, 'log-turn');
    logResult('手札からカードを1枚選んでください。', true); // ターンリザルト初期化
    gameState.gamePhase = 'selectCard';
}

function createDeck() {
    const newDeck = [];
    DECK_CONFIG.forEach(cardType => {
        if (cardType.type === 'color') {
            COLORS.forEach(color => {
                // 各色2枚ずつ (計14枚)
                for (let i = 0; i < 2; i++) {
                    newDeck.push({ type: 'color', value: 2, color: color });
                }
            });
        } else {
            for (let i = 0; i < cardType.count; i++) {
                newDeck.push({
                    type: cardType.type,
                    value: cardType.value || null,
                    effect: cardType.effect || null
                });
            }
        }
    });
    // シャッフル
    newDeck.sort(() => Math.random() - 0.5);
    return newDeck;
}

function drawCards(player, count) {
    for (let i = 0; i < count; i++) {
        if (gameState.deck.length === 0) {
            if (gameState.discardPile.length === 0) {
                log('山札も捨て札もありません！');
                break;
            }
            log('山札が尽きました。捨て札をシャッフルします。');
            gameState.deck = gameState.discardPile;
            gameState.discardPile = [];
            gameState.deck.sort(() => Math.random() - 0.5);
        }
        player.hand.push(gameState.deck.pop());
    }
}


// --- 5. ゲームロジック (ターン進行) ---

// 5.2 AIのカード選択
function selectAiCards() {
    const selections = [];
    
    // AIプレイヤーのみ (index 1以降)
    for (let i = 1; i < gameState.players.length; i++) {
        const ai = gameState.players[i];
        const hand = ai.hand;
        const myColor = ai.assignedColor;
        const myRank = gameState.rankingBoard.indexOf(myColor);

        let selectedCardIndex = 0; // デフォルトは0番目

        // --- 性格別ロジック ---
        switch (ai.personality) {
            // 3. 神出鬼没な道化師
            case 'CHAOS':
                const shuffleCardIndex = hand.findIndex(c => c.effect === 'shuffle');
                const changeCardIndex = hand.findIndex(c => c.effect === 'change');
                if (shuffleCardIndex !== -1) {
                    selectedCardIndex = shuffleCardIndex; // シャッフル即使用
                } else if (changeCardIndex !== -1) {
                    selectedCardIndex = changeCardIndex; // チェンジ即使用
                } else {
                    selectedCardIndex = Math.floor(Math.random() * hand.length); // 完全ランダム
                }
                break;

            // 1. 猪突猛進な勝負師
            case 'ATTACKER':
                const oneCardIndex = hand.findIndex(c => c.value === 1);
                const x2CardIndex = hand.findIndex(c => c.effect === 'x2');
                if (x2CardIndex !== -1) {
                    selectedCardIndex = x2CardIndex; // x2優先
                } else if (oneCardIndex !== -1) {
                    selectedCardIndex = oneCardIndex; // 「1」を最優先
                } else if (hand.some(c => c.value === 3)) {
                    selectedCardIndex = hand.findIndex(c => c.value === 3);
                }
                break;

            // 2. 用意周到な観測者
            case 'SAFE':
                // 「1」と「x2」は絶対に使わない。「5」も削除された
                const safeCards = hand.map((card, index) => ({ card, index }))
                                     .filter(item => item.card.value !== 1 && item.card.effect !== 'x2' && item.card.effect !== 'change' && item.card.effect !== 'shuffle');
                
                if (safeCards.length > 0) {
                    // 「3」や「4」を優先
                    const fourIndex = safeCards.find(item => item.card.value === 4);
                    const threeIndex = safeCards.find(item => item.card.value === 3);
                    
                    if (fourIndex) selectedCardIndex = fourIndex.index;
                    else if (threeIndex) selectedCardIndex = threeIndex.index;
                    else selectedCardIndex = safeCards[0].index; // 残った安全なカード
                } else {
                    // 安全なカードがない場合、仕方なく0番目
                    selectedCardIndex = 0;
                }
                break;

            // 6. 日和見な漁夫
            case 'OPPORTUNIST':
                // 「1」と「シャッフル」は絶対に使わない
                const oppCards = hand.map((card, index) => ({ card, index }))
                                     .filter(item => item.card.value !== 1 && item.card.effect !== 'shuffle');

                if (oppCards.length > 0) {
                    // 「+2」か「3」を最優先
                    const plusTwoIndex = oppCards.find(item => item.card.type === 'color');
                    const threeIndex = oppCards.find(item => item.card.value === 3);
                    
                    if (plusTwoIndex) selectedCardIndex = plusTwoIndex.index;
                    else if (threeIndex) selectedCardIndex = threeIndex.index;
                    else selectedCardIndex = oppCards[0].index; // 残ったカード
                } else {
                    selectedCardIndex = 0;
                }
                break;
                
            // 4. 仮面の戦略家
            case 'BLUFFER':
                // 「1」と特殊カードは使わない
                const bluffCards = hand.map((card, index) => ({ card, index }))
                                     .filter(item => item.card.value !== 1 && item.card.type !== 'special');

                if (bluffCards.length > 0) {
                    const fourIndex = bluffCards.find(item => item.card.value === 4);
                    const threeIndex = bluffCards.find(item => item.card.value === 3);
                    // 「+2」カード (ブラフ用)
                    const plusTwoIndex = bluffCards.find(item => item.card.type === 'color' && item.card.color !== myColor); 

                    if (plusTwoIndex) selectedCardIndex = plusTwoIndex.index; // 他人の+2を優先
                    else if (fourIndex) selectedCardIndex = fourIndex.index;
                    else if (threeIndex) selectedCardIndex = threeIndex.index;
                    else selectedCardIndex = bluffCards[0].index;
                } else {
                    selectedCardIndex = 0;
                }
                break;

            // 5. 冷徹な分析家 (簡易ロジック)
            case 'LOGIC':
            default: // デフォルト (分析家)
                // 自分が1位なら「1」で逃げる
                if (myRank === 0 && hand.some(c => c.value === 1)) {
                    selectedCardIndex = hand.findIndex(c => c.value === 1);
                } 
                // 自分が下位なら「シャッフル」
                else if (myRank >= 4 && hand.some(c => c.effect === 'shuffle')) {
                     selectedCardIndex = hand.findIndex(c => c.effect === 'shuffle');
                }
                // 自分の「+2」でZONE/UPを狙えるなら出す
                else if (hand.some(c => c.type === 'color' && c.color === myColor)) {
                    selectedCardIndex = hand.findIndex(c => c.type === 'color' && c.color === myColor);
                }
                // 「x2」と「CRUSH/ZONE」マスを狙う (簡易版では省略)
                else {
                    // バッティングしにくい「3」か「4」
                    if (hand.some(c => c.value === 3)) selectedCardIndex = hand.findIndex(c => c.value === 3);
                    else if (hand.some(c => c.value === 4)) selectedCardIndex = hand.findIndex(c => c.value === 4);
                }
                break;
        }

        const selectedCard = ai.hand.splice(selectedCardIndex, 1)[0];
        selections.push({ playerId: ai.id, card: selectedCard });
    }
    return selections;
}

// 5.3 解決フェーズ (Async)
async function resolveTurn(selections) {
    
    // ★ ターン開始処理
    gameState.currentTurn++;
    gameState.currentTurnData = {
        turn: gameState.currentTurn,
        minVal: 'N/A',
        movers: [],
        batting: 'なし',
        results: [] // ターンの結果ログ用
    };
    
    // 捨て札に追加
    selections.forEach(s => gameState.discardPile.push(s.card));
    
    // カード公開
    renderRevealArea(selections);
    // turnResultEl.innerHTML = ''; // endTurnでまとめて描画
    
    log(`【ターン ${gameState.currentTurn}】`, 'log-turn');
    
    selections.forEach(s => {
        const logMsg = `${s.playerId} が ${getCardName(s.card)} を出しました。`;
        log(logMsg);
    });
    // ★ ターンリザルト用ログ (削除)
    // logResult(`[${selections.map(s => getCardName(s.card)).join(', ')}] が出ました。`); 

    // --- 【A】フェーズ1：特殊効果 ---
    await delay(1000);
    const specialEffectResult = await resolvePhaseA(selections);
    
    // シャッフルやチェンジでターンが終了する場合がある
    if (specialEffectResult === 'turnEnd') {
        await endTurn();
        return;
    }

    // --- 【B】フェーズ2：移動 ---
    await delay(1000);
    const phaseBResult = await resolvePhaseB(selections); // 戻り値を受け取る
    await delay(1000);

    // --- ゲーム終了判定 ---
    // moveBigKoma がゴールを検知した場合
    if (phaseBResult === 'gameEnd') { 
        log('3周終了。ゲーム終了です。');
        endGame();
        return; // endTurn() をスキップ
    }
    
    // --- ターン終了・次へ ---
    await endTurn();
}

async function endTurn() {
    log('ターン終了。手札を補充します。', 'log-turn');
    
    // 順位変動履歴を保存
    gameState.history.rankHistory.push({
        turn: gameState.currentTurn,
        ranking: [...gameState.rankingBoard]
    });
    
    // ターンリザルトを履歴に追加
    gameState.turnResultHistory.unshift(gameState.currentTurnData); // 先頭に追加
    if (gameState.turnResultHistory.length > 3) { // 3件まで保持
        gameState.turnResultHistory.pop();
    }
    renderTurnResult(); // 画面に描画
    
    // 手札補充
    gameState.players.forEach(player => {
        const needed = 3 - player.hand.length;
        if (needed > 0) {
            drawCards(player, needed);
        }
    });
    
    renderPlayerHand();
    renderAiStatus(); // 公開情報更新
    
    // 次のターン開始の指示 (これは詳細ログのみ)
    // logResult('手札からカードを1枚選んでください。'); 
    gameState.gamePhase = 'selectCard';
}

// 5.4.1 フェーズA (特殊効果) (仕様書 3.2)
async function resolvePhaseA(selections) {
    const specialCards = selections.filter(s => s.card.type === 'special');

    log('【フェーズA：特殊効果判定】', 'log-phaseA');
    // logResult('【フェーズA】', 'res-phaseA'); // ★ 削除
    
    if (specialCards.length === 0) {
        log('特殊カードなし。移動倍率は x1 です。');
        // logResult('特殊効果なし (移動 x1)', 'res-phaseA'); // ★ 削除
        gameState.turnMultiplier = 1; // 1に設定
    } else if (specialCards.length === 1) {
        const card = specialCards[0];
        const effect = card.card.effect;
        const ownerId = card.playerId;
        log(`特殊カードが1枚！ ${ownerId} の「${effect}」が発動！`, 'log-phaseA');
        
        if (effect === 'x2') {
            gameState.turnMultiplier = 2; // 2に設定
            // logResult(`「x2」発動！ (移動 x2)`, 'res-phaseA'); // ★ 削除
        } else if (effect === 'change') {
            gameState.turnMultiplier = 1; // 1に設定 (移動はしないが念のため)
            // logResult(`「駒チェンジ」発動！`, 'res-phaseA'); // ★ 削除
            log(`${ownerId} が入れ替える2つの駒を選びます...`);
            const [color1, color2] = await selectTwoTargets(ownerId);
            log(`${ownerId} は【${color1}】と【${color2}】を選びました。`, 'log-phaseA');
            
            // 順位ボードの入れ替え (仕様書 5.4)
            const rank1 = gameState.rankingBoard.indexOf(color1);
            const rank2 = gameState.rankingBoard.indexOf(color2);
            
            if (rank1 !== -1 && rank2 !== -1) {
                gameState.rankingBoard[rank1] = color2;
                gameState.rankingBoard[rank2] = color1;
                log(`【${color1}】(${rank1+1}位) と 【${color2}】(${rank2+1}位) の順位が入れ替わりました。`, 'log-effect');
                logResult(`【${color1}】↔【${color2}】`, 'res-effect'); 
                renderRankingBoard();
            }
            return 'turnEnd'; // 移動フェーズなし
            
        } else if (effect === 'shuffle') {
            gameState.turnMultiplier = 1; // 1に設定 (移動はしないが念のため)
            // logResult(`「担当駒シャッフル」発動！`, 'res-phaseA'); // ★ 削除
            log('担当駒をシャッフルします！', 'log-phaseA');
            
            // (仕様書 5.5)
            let assignedColors = gameState.players.map(p => p.assignedColor);
            
            assignedColors.sort(() => Math.random() - 0.5); // シャッフル
            
            gameState.players.forEach((player, index) => {
                // 履歴保存
                if (player.assignedColor !== assignedColors[index]) {
                    gameState.history.shuffleHistory.push({
                        turn: gameState.currentTurn,
                        player: player.id,
                        oldColor: player.assignedColor,
                        newColor: assignedColors[index]
                    });
                }
                
                player.assignedColor = assignedColors[index];
                player.revealed = false; // 非公開に戻る
            });
            
            log('新しい担当駒が配られました。');
            renderPlayerInfo(); // 自分の担当駒UIを更新
            log(`あなたの新しい担当は【${gameState.players[0].assignedColor.toUpperCase()}】です。`, 'log-effect');
            logResult(`担当駒シャッフル！`, 'res-effect'); 
            return 'turnEnd'; // 移動フェーズなし
        }
    } else { // 2枚以上
        log('特殊カードが2枚以上出たため、すべて無効になります。移動倍率は x1 です。');
        // logResult('特殊効果が無効になりました (移動 x1)', 'res-phaseA'); // ★ 削除
        gameState.turnMultiplier = 1; // 1に設定
    }
    return 'continue'; // 移動フェーズへ
}

// 5.4.2 フェーズB (移動) (仕様書 3.3)
async function resolvePhaseB(selections) {
    
    // 「+2」カード (type: 'color') は数字カードとして扱う
    const numberCards = selections
        .filter(s => s.card.type === 'number' || s.card.type === 'color')
        .map(s => ({ ...s, value: s.card.value })); // 'color'もvalue=2として扱う
        
    log('【フェーズB：移動判定】', 'log-phaseB');
    // logResult('【フェーズB】', 'res-phaseB'); // ★ 削除

    if (numberCards.length === 0) {
        log('数字カードが0枚です。大駒は移動しません。');
        logResult('移動なし (数字カード 0枚)', 'res-phaseB'); 
        gameState.currentTurnData.minVal = 'なし';
        return 'continue'; // 戻り値
    }

    // 最小数字の特定
    const minVal = Math.min(...numberCards.map(c => c.value));
    const movers = numberCards.filter(c => c.value === minVal);
    
    // ★ ターンリザルト用に保存
    gameState.currentTurnData.minVal = minVal;
    gameState.currentTurnData.movers = movers.map(m => m.playerId);
    
    log(`最小数字は「${minVal}」です。`);

    // (仕様書 3.3)
    const moveAmount = minVal * gameState.turnMultiplier;
    log(`移動マス数: ${minVal} x ${gameState.turnMultiplier} = ${moveAmount}`, 'log-phaseB');

    if (movers.length === 1) {
        // --- A. バッティングなし ---
        const mover = movers[0];
        log(`${mover.playerId} が移動権利者（バッティングなし）。`);
        // logResult(`${mover.playerId} が ${moveAmount} マス移動 (x${gameState.turnMultiplier})`, 'res-phaseB'); // ★ 削除
        
        const didGoal = await moveBigKoma(moveAmount); // 戻り値を受け取る
        if (didGoal) return 'gameEnd'; // ゴールしたらマス効果を処理せず終了

        const effect = COURSE_MAP[gameState.bigKomaPosition];
        log(`止まったマスの効果: ${effect}`, 'log-effect');
        
        if (effect === '・' || effect === 'START' || effect === 'GOAL') {
             logResult(`マス: ${effect} (効果なし)`, 'res-effect'); 
             return 'continue'; // 戻り値
        }
        logResult(`マス: ${effect}`, 'res-effect'); 

        // 対象の決定 (仕様書 4.1 A)
        let targetColor;
        if (mover.card.type === 'color') {
            targetColor = mover.card.color;
            log(`${mover.playerId} のカードは色指定のため、強制的に【${targetColor.toUpperCase()}】が対象です。`);
            // logResult(`対象: 【${targetColor.toUpperCase()}】 (カード指定)`, 'res-effect'); // ★ 削除
        } else {
            log(`${mover.playerId} がマスの効果の対象を選びます...`);
            targetColor = await selectTarget(mover.playerId, effect); // ※仕様書 4.1 A (RESOLVE_BATTING)
            log(`${mover.playerId} は【${targetColor.toUpperCase()}】を選びました。`);
            // logResult(`対象: 【${targetColor.toUpperCase()}】 (${mover.playerId}選択)`, 'res-effect'); // ★ 削除
        }
        
        applyMassEffect(effect, [targetColor]);
        return 'continue'; // 戻り値

    } else {
        // --- B. バッティングあり ---
        gameState.currentTurnData.batting = 'あり'; // ★ ターンリザルト用
        log(`バッティング発生！ ${movers.map(m => m.playerId).join(', ')} が「${minVal}」を出しました。`, 'log-penalty');
        // logResult(`バッティング！ ${moveAmount} マス移動 (x${gameState.turnMultiplier})`, 'res-penalty'); // ★ 削除
        
        const didGoal = await moveBigKoma(moveAmount); // 戻り値を受け取る
        if (didGoal) return 'gameEnd'; // ゴールしたらマス効果を処理せず終了

        const effect = COURSE_MAP[gameState.bigKomaPosition];
        log(`止まったマスの効果: ${effect}`, 'log-effect');
        
        if (effect === '・' || effect === 'START' || effect === 'GOAL') {
            logResult(`マス: ${effect} (効果なし)`, 'res-effect'); 
            return 'continue'; // 戻り値
        }
        logResult(`マス: ${effect}`, 'res-effect'); 

        // (仕様書v1.0 4.1, 4.2 'PLUS_TWO' 対応)
        const isPlusTwoBatting = (minVal === 2);
        
        if (isPlusTwoBatting) {
            // --- B-2. 「+2」を含むバッティング (仕様書 4.2 'PLUS_TWO') ---
            log('「+2」を含むバッティングです。色ごとの集計を行います。');
            
            const colorCounts = {}; // {'red': 2, 'blue': 1}
            const colorMoverMap = {}; // {'red': [player1, player2], 'blue': [player3]}
            const playersForStandardBatting = []; // +2以外 (1,3,4,5) のカードを出した人

            for (const mover of movers) {
                if (mover.card.type === 'color') {
                    const color = mover.card.color;
                    colorCounts[color] = (colorCounts[color] || 0) + 1;
                    if (!colorMoverMap[color]) {
                        colorMoverMap[color] = [];
                    }
                    colorMoverMap[color].push(mover);
                } else {
                    // (仕様書にはないが、'2'と'RED+2'がバッティングした場合のフォールバック)
                    playersForStandardBatting.push(mover);
                }
            }

            const finalTargetList = []; // 指差しなしで確定する駒 (被らなかった駒)
            const playersForBatting = [...playersForStandardBatting]; // 指差しフェーズに進むプレイヤー
            
            if (playersForStandardBatting.length > 0) {
                 log('「+2」以外の数字カードがバッティングに含まれたため、全員が標準の指差しフェーズに進みます。');
                 // +2カードを出した人も全員、標準指差しに巻き込む
                 for (const color in colorMoverMap) {
                     playersForBatting.push(...colorMoverMap[color]);
                 }
            } else {
                // +2同士の処理
                for (const color in colorCounts) {
                    if (colorCounts[color] === 1) {
                        // 1枚だけ = 被らなかった駒 (仕様書 4.2 '回避者')
                        finalTargetList.push(color);
                        log(`【${color.toUpperCase()}】は被らなかったため、効果対象（指差しなし）となります。`);
                    } else {
                        // 2枚以上 = 被った駒 (仕様書 4.2 'B-2/B-3')
                        playersForBatting.push(...colorMoverMap[color]);
                        log(`【${color.toUpperCase()}】で被ったプレイヤーが指差しフェーズに進みます。`);
                    }
                }
            }
            
            // 先に、指差しなしで確定した駒の効果を適用
            if (finalTargetList.length > 0) {
                // logResult(`「+2」被りなし: ${finalTargetList.map(t => t.toUpperCase()).join(', ')} が対象`, 'res-effect'); // ★ 削除
                applyMassEffect(effect, finalTargetList);
            }

            // 被ったプレイヤーが残っている場合、彼らだけで指差しフェーズへ
            if (playersForBatting.length > 0) {
                // if (finalTargetList.length > 0) { // ★ 削除
                //     logResult(`...残りの被ったプレイヤーが指差し開始...`, 'res-penalty'); 
                // } else {
                //     logResult(`「+2」が被ったため指差し開始...`, 'res-penalty'); 
                // }
                
                // 指差し実行 (仕様書 4.2 'STANDARD')
                await executeStandardBatting(playersForBatting, effect);
                return 'continue'; // 戻り値
            } else {
                // 被ったプレイヤーがいない (例: RED+2, BLUE+2 のみ)
                return 'continue'; // 戻り値
            }
        }
        
        // --- B-1. 通常の指差しフェーズ (仕様書 4.1 B-1) ---
        // (最小値が 1, 3, 4, 5 の場合)
        // logResult(`「${minVal}」でバッティング！ 指差し開始...`, 'res-penalty'); // ★ 削除
        await executeStandardBatting(movers, effect);
        return 'continue'; // 戻り値
    }
}

// 標準バッティング処理
async function executeStandardBatting(battingPlayers, effect) {
    log('【バッティング処理：指差し】', 'log-penalty');

    let targets = []; // { playerId: 'player', target: 'red' }
    for (const mover of battingPlayers) { // 引数 'battingPlayers' を使用
        
        let target;
        
        // (v12修正)
        // この関数 (STANDARD) が呼ばれた時点で、
        // たとえ +2 カード (color) を持っていても、それは無視し（権利失効）、
        // プレイヤーに自由に指差し (selectTarget) させるのが仕様書 4.2 の挙動。
        target = await selectTarget(mover.playerId, effect);
        log(`${mover.playerId} は【${target.toUpperCase()}】を指差しました。`);

        targets.push({ playerId: mover.playerId, target: target });
        await delay(500);
    }

    // ステップ3：解決
    const firstTarget = targets[0].target;
    const allSame = targets.every(t => t.target === firstTarget);

    if (allSame) {
        // B. 全員が同じ駒を指差した場合 (v1ルール準拠)
        log(`全員が【${firstTarget.toUpperCase()}】を指差しました！`, 'log-penalty');
        log('ペナルティ発生！ 指差した全員の担当駒を公開します！');
        logResult(`全員が【${firstTarget.toUpperCase()}】を指名！ ペナルティ！`, 'res-penalty'); 
        
        let penaltyTargets = []; // (仕様書 4.3 ApplyPenalty)
        
        for (const t of targets) {
            const player = gameState.players.find(p => p.id === t.playerId);
            if (player) {
                if (!player.revealed) {
                    player.revealed = true;
                    log(`${player.id} の担当駒【${player.assignedColor.toUpperCase()}】が公開されます！`, 'log-penalty');
                    logResult(`${player.id} の【${player.assignedColor.toUpperCase()}】が公開！`, 'res-penalty'); 
                }
                penaltyTargets.push(player.assignedColor);
            }
        }
        
        log(`狙われた【${firstTarget.toUpperCase()}】は無傷です。代わりにペナルティを受けた駒が効果を受けます。`);
        
        const uniquePenaltyTargets = [...new Set(penaltyTargets)];
        if (uniquePenaltyTargets.length > 0) {
             applyMassEffect(effect, uniquePenaltyTargets); 
        } else {
             log(`ペナルティ対象の駒がありませんでした。`);
        }
       
    } else {
        // A. 違う駒を指差した場合 (v1ルール説明書 準拠)
        log('指差しがバラけました。（ルールA適用）'); 
        const uniqueTargets = [...new Set(targets.map(t => t.target))]; // 指差された駒
        log(`対象: ${uniqueTargets.map(t => t.toUpperCase()).join(', ')}。順位が下位の駒から効果を適用します。`); 
        // logResult(`指差しがバラけました。対象: ${uniqueTargets.map(t => t.toUpperCase()).join(', ')}`, 'res-effect'); // ★ 削除
        
        applyMassEffect(effect, uniqueTargets);
    }
}


// 5.5 対象選択 (人間 / AI) (仕様書 4.1 A)
async function selectTarget(playerId, effect) {
    if (playerId === 'player') {
        // 人間の選択
        log('【あなた】マスの効果を適用する駒を選んでください。（順位ボードをクリック）');
        // logResult('【あなた】対象の駒を順位ボードから選んでください...', 'res-phaseB'); // ★ 削除
        rankingBoardEl.classList.add('selectable');
        
        return new Promise((resolve) => {
            const listener = (e) => {
                const targetLi = e.target.closest('li[data-color]');
                if (!targetLi) return;
                
                const color = targetLi.dataset.color;
                rankingBoardEl.classList.remove('selectable');
                rankingBoardEl.removeEventListener('click', listener);
                resolve(color);
            };
            rankingBoardEl.addEventListener('click', listener);
        });
        
    } else {
        // --- AIの選択 ---
        await delay(500); // AIが考えてるフリ
        const ai = gameState.players.find(p => p.id === playerId);
        const myColor = ai.assignedColor;
        const topColor = gameState.rankingBoard[0];
        const bottomColor = gameState.rankingBoard[6];

        switch (ai.personality) {
            // 1. 猪突猛進な勝負師
            case 'ATTACKER':
                log(`${ai.id} (猪突猛進) は 1位 を狙います。`);
                return topColor;
            
            // 2. 用意周到な観測者
            case 'SAFE':
                const npcTarget = gameState.rankingBoard.find(color => gameState.npcColors.includes(color));
                if (npcTarget) {
                    log(`${ai.id} (観測者) は NPC駒 を指します。`);
                    return npcTarget;
                }
                log(`${ai.id} (観測者) は 最下位 を指します。`);
                return bottomColor;
            
            // 3. 神出鬼没な道化師
            case 'CHAOS':
                const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
                log(`${ai.id} (道化師) は ランダム に指します。`);
                return randomColor;
            
            // 4. 仮面の戦略家
            case 'BLUFFER':
                // 自分の駒以外で、最下位の駒（目立たない）を指す
                const bluffTarget = (bottomColor !== myColor) ? bottomColor : gameState.rankingBoard[5];
                log(`${ai.id} (戦略家) は 自分の駒以外 を指します。`);
                return bluffTarget;

            // 6. 日和見な漁夫
            case 'OPPORTUNIST':
                // 観測者とほぼ同じだが、ヘイトを恐れる
                const oppNpcTarget = gameState.rankingBoard.find(color => gameState.npcColors.includes(color));
                if (oppNpcTarget) {
                    log(`${ai.id} (日和見) は NPC駒 を指します。`);
                    return oppNpcTarget;
                }
                log(`${ai.id} (日和見) は 最下位 を指します。`);
                return bottomColor;

            // 5. 冷徹な分析家 (デフォルト)
            case 'LOGIC':
            default:
                // 合理的な選択
                if (effect.includes('UP') || effect === 'ZONE') {
                    log(`${ai.id} (分析家) は 自分の駒 を指します。`);
                    return myColor; // 自分を上げる
                } else {
                    // 自分以外で一番順位が高い駒
                    const target = (topColor !== myColor) ? topColor : gameState.rankingBoard[1];
                    log(`${ai.id} (分析家) は 脅威となる駒 を指します。`);
                    return target;
                }
        }
    }
}

// 5.5.1 駒チェンジ用 (2つ選ぶ) (仕様書 5.4)
async function selectTwoTargets(playerId) {
    if (playerId === 'player') {
        log('【あなた】入れ替える駒を2つ選んでください。');
        // logResult('【あなた】入れ替える駒を2つ選んでください...', 'res-phaseA'); // ★ 削除
        rankingBoardEl.classList.add('selectable');
        
        let selections = [];
        return new Promise((resolve) => {
            const listener = (e) => {
                const targetLi = e.target.closest('li[data-color]');
                if (!targetLi) return;
                
                const color = targetLi.dataset.color;
                if (!selections.includes(color)) {
                    selections.push(color);
                    targetLi.style.border = '2px solid var(--color-neon-blue)'; // 選択中表示
                    log(`1つ目: 【${color.toUpperCase()}】`);
                }
                
                if (selections.length === 2) {
                    rankingBoardEl.classList.remove('selectable');
                    rankingBoardEl.removeEventListener('click', listener);
                    // 選択中表示をリセット
                    rankingBoardEl.querySelectorAll('li').forEach(li => li.style.border = '');
                    resolve(selections);
                }
            };
            rankingBoardEl.addEventListener('click', listener);
        });

    } else {
        // --- AIの選択 ---
        await delay(500);
        const ai = gameState.players.find(p => p.id === playerId);
        const myColor = ai.assignedColor;
        const myRank = gameState.rankingBoard.indexOf(myColor);
        const topColor = gameState.rankingBoard[0];
        const bottomColor = gameState.rankingBoard[6];

        let color1, color2;

        if (ai.personality === 'CHAOS') {
            // 3. 道化師: 1位と7位を入れ替える
            color1 = topColor;
            color2 = bottomColor;
        } else {
            // デフォルト (分析家、勝負師など): 自分の順位を上げる
            color1 = myColor;
            if (myRank > 0) {
                color2 = topColor; // 1位と入れ替える
            } else {
                color2 = bottomColor; // 自分が1位なら7位と入れ替える (妨害)
            }
        }
        
        // 万が一、2つが同じ駒になってしまった場合のフォールバック
        if (color1 === color2) { 
             color2 = gameState.rankingBoard.find(c => c !== color1);
        }
        return [color1, color2];
    }
}

// 5.6 マス効果の適用 (仕様書 5.2)
function applyMassEffect(effect, targetColors) {
    // 順位ボード (gameState.rankingBoard) を操作
    
    // 対象を、順位が下位の駒から順に処理 (仕様書 3.4)
    const sortedTargets = targetColors
        .map(color => ({ color, rank: gameState.rankingBoard.indexOf(color) }))
        .sort((a, b) => b.rank - a.rank); // ランク(index)が大きい(下位)順
        
    log(`効果適用: ${effect} / 対象: ${sortedTargets.map(t => t.color.toUpperCase()).join(', ')} (下位から適用開始)`, 'log-effect'); 

    for (const target of sortedTargets) {
        let currentRank = gameState.rankingBoard.indexOf(target.color);
        if (currentRank === -1) continue; // 既に変動した
        
        let newRank = currentRank;
        let logMessage = `【${target.color.toUpperCase()}】: `;
        
        if (effect.includes('UP')) {
            const amount = parseInt(effect[0]);
            newRank = Math.max(0, currentRank - amount);
            logMessage += `${currentRank + 1}位 → ${newRank + 1}位`;
        } else if (effect.includes('DOWN')) {
            const amount = parseInt(effect[0]);
            newRank = Math.min(COLORS.length - 1, currentRank + amount);
            logMessage += `${currentRank + 1}位 → ${newRank + 1}位`;
        } else if (effect === 'CRUSH') {
            newRank = COLORS.length - 1;
            logMessage += `${currentRank + 1}位 → 7位 (CRUSH)`;
        } else if (effect === 'ZONE') {
            newRank = 0;
            logMessage += `${currentRank + 1}位 → 1位 (ZONE)`;
        }

        if (currentRank !== newRank) {
            // 順位入れ替え処理
            const [movedColor] = gameState.rankingBoard.splice(currentRank, 1);
            gameState.rankingBoard.splice(newRank, 0, movedColor);
            log(`【${movedColor.toUpperCase()}】が ${currentRank + 1}位 から ${newRank + 1}位 に移動。 (適用完了)`, 'log-effect'); 
        } else {
            log(`【${target.color.toUpperCase()}】は ${effect} を受けましたが、変動しませんでした。`);
            logMessage += `変動なし`;
        }
        
        logResult(logMessage, 'res-effect'); // ターンリザルトにも結果を簡易表示
    }
    
    renderRankingBoard(); // 仕様書 5.3 UpdateAllRanks() に相当
}

// 5.7 大駒の移動 (仕様書 5.1)
async function moveBigKoma(amount) {
    // 現在の絶対位置を取得
    let totalPosition = gameState.bigKomaPosition + (gameState.currentLap - 1) * COURSE_LENGTH;
    // 3周目GOALの絶対位置(95) または GOAL通過(96)
    const goalPositionThreshold = (LAPS_TO_WIN * COURSE_LENGTH) - 1; // 95
    
    for (let i = 0; i < amount; i++) {
        totalPosition++; // 1マスずつ進める
        
        // totalPosition が 95 (3周目の31) 以上になったらゴール
        if (totalPosition >= goalPositionThreshold) {
             
             // UIをGOALマスに固定
             gameState.currentLap = 4; // 終了判定用
             gameState.bigKomaPosition = 31; // GOALマス
             updateBigKomaPosition(); 
             return true; // ゴールしたことを通知
        }

        // ラップと位置を計算
        gameState.currentLap = Math.floor(totalPosition / COURSE_LENGTH) + 1;
        gameState.bigKomaPosition = totalPosition % COURSE_LENGTH;

        updateBigKomaPosition();
        await delay(100); 
    }
    return false; // ゴールしていない
}


// 5.8 ゲーム終了 (仕様書 5.6)
function endGame() {
    gameState.gamePhase = 'endGame';
    log('ゲーム終了！', 'log-turn');
    
    const winnerColor = gameState.rankingBoard[0];
    log(`最終順位 1位は... 【${winnerColor.toUpperCase()}】！`);
    
    const player = gameState.players[0];
    let title = "GAME OVER";
    let resultText = "";
    
    // --- 判定ロジック ---
    if (player.assignedColor === winnerColor) {
        title = "YOU WIN!";
        resultText = `<p>おめでとうございます！ あなたの勝利です！</p>`;
        log(resultText);
    } else {
        const winnerAi = gameState.players.find(p => p.assignedColor === winnerColor);
        if (winnerAi) {
            resultText = `<p>${winnerAi.id} (【${winnerColor.toUpperCase()}】) の勝利です。あなたの負けです。</p>`;
            log(resultText);
        } else if (gameState.npcColors.includes(winnerColor)) {
            // NPC勝利メッセージ
            title = "ALL LOSE";
            resultText = `<p>NPC駒 (【${winnerColor.toUpperCase()}】) が1位になりました。全員の敗北です。</p>`;
            log(resultText);
        }
    }
    
    // 全プレイヤーの正体を表示
    resultText += "<hr><h3>【正体公開】</h3>";
    gameState.players.forEach(p => {
        // 自分のIDを「あなた」に変更
        const playerName = (p.id === 'player') ? 'あなた' : p.id;
        // AIの性格も表示
        const personalityName = (p.personality === 'HUMAN') ? '' : ` (${AI_PERSONALITIES[p.personality]})`;
        
        resultText += `<p><strong>${playerName}${personalityName}:</strong> 【${p.assignedColor.toUpperCase()}】</p>`;
    });
    
    // 終了モーダル表示
    endGameTitle.innerText = title;
    endGameResult.innerHTML = resultText; 
    endGameModal.classList.remove('hidden');
    
    // ★ グラフ描画
    renderResultChart();
}


// --- 6. UI描画 ---
function renderAll() {
    renderCourseBoard();
    renderRankingBoard();
    renderPlayerHand();
    renderPlayerInfo();
    renderAiStatus();
}

function renderCourseBoard() {
    // (コースは静的だが、大駒の位置を更新)
    updateBigKomaPosition();
}

function updateBigKomaPosition() {
    // 周回数
    let displayLap = gameState.currentLap;
    if (displayLap > LAPS_TO_WIN) displayLap = LAPS_TO_WIN; // 4周目は3周目として表示
    lapCounterEl.innerText = `Lap: ${displayLap} / ${LAPS_TO_WIN}`;
    
    // マス位置
    const currentMassIndex = gameState.bigKomaPosition; // 0-31
    bigKomaPositionEl.innerText = `Position: ${currentMassIndex} / ${COURSE_LENGTH - 1}`;
    
    // 大駒のUIを移動
    const cell = courseBoardEl.querySelector(`.course-cell[data-index="${currentMassIndex}"]`);
    if (cell) {
        bigKomaEl.style.top = `${cell.offsetTop + cell.offsetHeight / 2 - bigKomaEl.offsetHeight / 2}px`;
        bigKomaEl.style.left = `${cell.offsetLeft + cell.offsetWidth / 2 - bigKomaEl.offsetWidth / 2}px`;
    }
}

// (仕様書 5.3 UpdateAllRanks に相当)
function renderRankingBoard() {
    rankingBoardEl.innerHTML = '';
    gameState.rankingBoard.forEach((color, index) => {
        const li = document.createElement('li');
        li.dataset.color = color;
        // (仕様書 1.3 Koma.currentRank の更新)
        li.innerHTML = `
            <span>${index + 1}.</span>
            <span class="koma ${color}"></span>
            <span class="koma-name">${color.toUpperCase()}</span>
        `;
        rankingBoardEl.appendChild(li);
    });
}

function renderPlayerHand() {
    playerHandEl.innerHTML = '';
    gameState.players[0].hand.forEach((card, index) => {
        const cardEl = createCardElement(card);
        cardEl.dataset.index = index;
        playerHandEl.appendChild(cardEl);
    });
}

function renderPlayerInfo() {
    const player = gameState.players[0];
    const color = player.assignedColor || '?';
    assignedColorDisplayEl.innerHTML = `<span class="koma ${color}">${color === '?' ? '?' : ''}</span>`;
    if (color !== '?') {
        assignedColorDisplayEl.classList.add(`color-${color}`);
    }
}

function renderAiStatus() {
    aiStatusEl.innerHTML = '';
    gameState.players.slice(1).forEach(ai => {
        const div = document.createElement('div');
        div.classList.add('ai-player');
        
        // AIの性格を表示
        const personalityName = AI_PERSONALITIES[ai.personality] || '不明';
        
        let colorInfo = '(秘密)';
        if (ai.revealed) {
            div.classList.add('revealed');
            div.style.color = `var(--color-${ai.assignedColor})`;
            colorInfo = `(【${ai.assignedColor.toUpperCase()}】)`;
        }
        // AI名 (性格) | (秘密) の形式に変更
        div.innerHTML = `<span>${ai.id} (${personalityName})</span> <span class="ai-color">${colorInfo}</span>`;
        aiStatusEl.appendChild(div);
    });
}

function renderRevealArea(selections) {
    revealAreaEl.innerHTML = '';
    selections.forEach(s => {
        const cardEl = createCardElement(s.card);
        cardEl.classList.add('revealed-card');
        cardEl.innerHTML += `<span class="card-owner">${s.playerId}</span>`;
        revealAreaEl.appendChild(cardEl);
    });
}

// (仕様書 1.5 Card に基づく)
function createCardElement(card) {
    const el = document.createElement('div');
    el.classList.add('card');
    let value = '', effect = '', colorClass = '';

    if (card.type === 'number') { // 'NUMBER'
        el.classList.add('type-number');
        value = card.value;
    } else if (card.type === 'color') { // 'SPECIAL_NUMBER'
        el.classList.add('type-color');
        colorClass = `color-${card.color}`;
        el.classList.add(colorClass);
        value = `+${card.value}`;
        effect = card.color.toUpperCase(); 
    } else if (card.type === 'special') { // 'SPECIAL_EFFECT'
        el.classList.add('type-special');
        effect = card.effect.toUpperCase();
    }
    
    el.innerHTML = `
        <span class="card-value">${value}</span>
        <span class="card-effect">${effect}</span>
    `;
    return el;
}

function getCardName(card) {
    if (card.type === 'number') return `「${card.value}」`;
    if (card.type === 'color') return `「${card.color.toUpperCase()} +${card.value}」`;
    if (card.type === 'special') return `「${card.effect.toUpperCase()}」`;
    return '（不明なカード）';
}


// --- 7. ユーティリティ ---
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 詳細ログ (右側)
function log(message, type = '') {
    const p = document.createElement('p');
    p.innerText = message;
    if (type) {
        p.classList.add(type);
    }
    logEl.appendChild(p);
    // 自動スクロール
    logEl.scrollTop = logEl.scrollHeight;
}

// ★★★ 修正点：ターンリザルト (テーブル) ★★★
// ログを一時配列に保存
function logResult(message, isNewTurn = false) {
    // 最初の「カードを選んでください」
    if (isNewTurn && gameState.currentTurn === 0) {
        turnResultEl.innerHTML = `<p>${message}</p>`;
        return;
    }
    // 実行中のターンのデータにログを追加
    if (gameState.currentTurnData && gameState.currentTurnData.results) {
        gameState.currentTurnData.results.push(message);
    }
}

// 履歴配列を描画
function renderTurnResult() {
    turnResultEl.innerHTML = ''; // クリア
    
    const table = document.createElement('table');
    table.innerHTML = '<thead><tr><th>T</th><th>Min(Player)</th><th>Batting</th><th>Result</th></tr></thead>';
    const tbody = document.createElement('tbody');

    // 新しい順 (unshiftで追加したので、そのままループ)
    gameState.turnResultHistory.forEach(data => {
        const tr = document.createElement('tr');
        
        // 1. ターン数
        const tdTurn = document.createElement('td');
        tdTurn.innerText = data.turn;
        
        // 2. 最小数字(出した人)
        const tdMin = document.createElement('td');
        if (data.movers.length === 1) {
            // プレイヤー名を「あなた」に変換
            const moverName = (data.movers[0] === 'player') ? 'あなた' : data.movers[0];
            tdMin.innerText = `${data.minVal} (${moverName})`;
        } else if (data.movers.length > 1) {
            tdMin.innerText = `${data.minVal} (${data.movers.length}人)`;
        } else {
            tdMin.innerText = 'なし';
        }

        // 3. バッティング
        const tdBatting = document.createElement('td');
        if (data.batting === 'あり') {
            tdBatting.innerText = 'あり';
            tdBatting.classList.add('res-batting');
        } else {
            tdBatting.innerText = 'なし';
            tdBatting.classList.add('res-no-batting');
        }
        
        // 4. 結果
        const tdResult = document.createElement('td');
        tdResult.innerHTML = data.results.join('<br>'); // HTMLとしてログを挿入

        tr.appendChild(tdTurn);
        tr.appendChild(tdMin);
        tr.appendChild(tdBatting);
        tr.appendChild(tdResult);
        tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
    turnResultEl.appendChild(table);
}

// グラフ描画関数
function renderResultChart() {
    const ctx = document.getElementById('result-chart').getContext('2d');
    
    // データ準備
    const history = gameState.history.rankHistory;
    const labels = history.map(h => `T${h.turn}`);
    
    // 順位は 1位=7, 7位=1 のように反転させてグラフ化 (上が1位になるように)
    const datasets = COLORS.map(color => {
        const data = history.map(h => {
            const rankIndex = h.ranking.indexOf(color); // 0位～6位
            return 7 - rankIndex; // 7点～1点
        });
        
        // 色の取得
        const colorVar = `--color-${color}`;
        const colorHex = getComputedStyle(document.documentElement).getPropertyValue(colorVar).trim();
        
        return {
            label: color.toUpperCase(),
            data: data,
            borderColor: colorHex,
            backgroundColor: colorHex,
            borderWidth: 3,
            fill: false,
            tension: 0.1,
            pointStyle: [], // シャッフル履歴用
            pointRadius: [], // シャッフル履歴用
        };
    });

    // シャッフル履歴のポイントを追加
    gameState.history.shuffleHistory.forEach(shuffle => {
        const turnIndex = labels.indexOf(`T${shuffle.turn}`);
        if (turnIndex === -1) return;
        
        // 色が変わったプレイヤーを探す
        const player = gameState.players.find(p => p.id === shuffle.player);
        if (!player) return;

        // 新しい色 (newColor) のデータセットを探す
        const newColorDataset = datasets.find(d => d.label === shuffle.newColor.toUpperCase());
        if (newColorDataset) {
            newColorDataset.pointStyle[turnIndex] = 'star';
            newColorDataset.pointRadius[turnIndex] = 10;
        }
    });

    // チャートを描画
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: '順位変動グラフ (1位が上)',
                    color: 'white',
                    font: { size: 16, family: 'Orbitron' }
                },
                legend: {
                    labels: {
                        color: 'white',
                        font: { family: 'Orbitron' }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            const rank = 8 - context.parsed.y;
                            label += `${rank} 位`;
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    min: 0,
                    max: 8,
                    ticks: {
                        color: 'white',
                        font: { family: 'Orbitron' },
                        callback: function(value) {
                            // 7点=1位, 1点=7位
                            if (value === 0 || value === 8) return '';
                            return `${8 - value} 位`; 
                        }
                    },
                    grid: {
                        color: '#444'
                    }
                },
                x: {
                    ticks: {
                        color: 'white',
                        font: { family: 'Orbitron' }
                    },
                    grid: {
                        color: '#444'
                    }
                }
            }
        }
    });
}