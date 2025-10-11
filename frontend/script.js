// 全局变量
const API_BASE = '';
let currentGameId = null;
let currentEvents = [];
let currentComments = [];
let statusPollingInterval = null;
let selectedEventIndex = null;

const eventTypes = [
    { value: "Goal", label: "进球" },
    { value: "Miss", label: "射门未进" },
    { value: "Foul", label: "犯规" },
    { value: "Out", label: "出界" },
    { value: "Continue", label: "比赛继续" },
    { value: "Breakthrough", label: "突破" },
    { value: "Save", label: "扑救" },
    { value: "Kickoff", label: "开球" },
    { value: "Tackle", label: "抢断" },
    { value: "Pass", label: "传球" },
    { value: "Comment", label: "解说" },
    { value: "Start", label: "比赛开始" },
    { value: "End", label: "比赛结束" },
    { value: "Other", label: "其它事件" },
];

const eventTypeMap = {};
eventTypes.forEach(type => {
    eventTypeMap[type.value] = type.label;
});

// 页面导航功能
function showMainPage() {
    document.getElementById('mainPage').classList.remove('hidden');
    document.getElementById('gameDetailPage').classList.add('hidden');
    loadGames();
}

function showGameDetail(gameId) {
    currentGameId = gameId;
    document.getElementById('mainPage').classList.add('hidden');
    document.getElementById('gameDetailPage').classList.remove('hidden');
    document.getElementById('gameDetailTitle').textContent = `比赛详情 - ${gameId}`;

    // 默认显示比赛详情tab
    showGameTab('detail');
}

// 标签页切换功能
function showGameTab(tabName) {
    // 隐藏所有标签页内容
    document.querySelectorAll('#gameDetailPage .tab-panel').forEach(panel => {
        panel.classList.remove('active');
    });

    // 移除所有标签的active类
    document.querySelectorAll('#gameDetailPage .tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // 显示选中的标签页
    let panelId;
    if (tabName === 'videos') {
        panelId = 'gameVideos';
    } else {
        panelId = 'game' + tabName.charAt(0).toUpperCase() + tabName.slice(1);
    }
    document.getElementById(panelId).classList.add('active');

    // 添加active类到对应的标签
    const tabs = document.querySelectorAll('#gameDetailPage .tab');
    tabs.forEach(tab => {
        if (tab.textContent.includes(getTabDisplayName(tabName))) {
            tab.classList.add('active');
        }
    });

    // 如果是视频管理tab，加载视频列表
    if (tabName === 'videos') {
        loadVideoList();
    }

    // 根据标签页加载相应数据
    switch (tabName) {
        case 'detail':
            loadGameDetail();
            break;
        case 'events':
            loadEvents();
            break;
        case 'video':
            loadTaskStatus();
            break;
        case 'comments':
            loadComments();
            break;
    }
}

function getTabDisplayName(tabName) {
    const nameMap = {
        'detail': '比赛详情',
        'events': '事件编辑',
        'video': '视频生成',
        'comments': '评论编辑',
        'videos': '视频管理'
    };
    return nameMap[tabName] || tabName;
}

// 模态框控制
function showModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function showCreateGameModal() {
    showModal('createGameModal');
    // 加载视频列表到创建比赛的视频选择框
    loadVideoListForCreateGame();
    // 生成节数视频选择框
    generateCreateGameVideoSelectors();
}

// 比赛管理功能
async function loadGames() {
    try {
        const response = await fetch(`${API_BASE}/games`);
        const data = await response.json();
        displayGames(data.games);
    } catch (error) {
        showAlert('加载比赛列表失败: ' + error.message, 'error');
    }
}

function displayGames(games) {
    const gamesList = document.getElementById('gamesList');
    if (games.length === 0) {
        gamesList.innerHTML = '<p>暂无比赛数据</p>';
        return;
    }

    gamesList.innerHTML = games.map(gameId => `
        <div class="game-card">
            <h3>比赛 ${gameId}</h3>
            <p>比赛ID: ${gameId}</p>
            <div class="game-actions">
                <button class="btn btn-primary" onclick="showGameDetail('${gameId}')">查看</button>
                <button class="btn btn-danger" onclick="deleteGame('${gameId}')">删除</button>
            </div>
        </div>
    `).join('');
}

async function deleteGame(gameId) {
    if (!confirm(`确定要删除比赛 ${gameId} 吗？此操作不可撤销！`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/game/${gameId}/clean`, {
            method: 'POST'
        });

        if (response.ok) {
            showAlert('比赛删除成功！', 'success');
            loadGames();
        } else {
            const error = await response.json();
            showAlert('删除比赛失败: ' + error.detail, 'error');
        }
    } catch (error) {
        showAlert('删除比赛失败: ' + error.message, 'error');
    }
}

// 比赛详情功能
async function loadGameDetail() {
    if (!currentGameId) {
        showAlert('请先选择一个比赛', 'error');
        return;
    }
    try {
        const response = await fetch(`${API_BASE}/game/${currentGameId}`);
        const data = await response.json();
        displayMatchDetails(data);
    } catch (error) {
        showAlert('加载比赛详情失败: ' + error.message, 'error');
    }
}

function displayMatchDetails(gameData) {
    // 比赛基本信息
    document.getElementById('matchName').value = gameData.name || '';
    document.getElementById('matchDescription').value = gameData.description || '';

    // 队伍信息
    if (gameData.teams && gameData.teams.length >= 2) {
        // 队伍1
        document.getElementById('team0Name').value = gameData.teams[0].name || '队伍1';
        document.getElementById('team0Score').value = gameData.teams[0].score || 0;
        document.getElementById('team0ColorSelect').value = gameData.teams[0].color || '深蓝';
        const team0Color = document.getElementById('team0Color');
        team0Color.setAttribute('data-color', gameData.teams[0].color || '');
        team0Color.style.backgroundColor = getColorValue(gameData.teams[0].color);

        // 队伍2
        document.getElementById('team1Name').value = gameData.teams[1].name || '队伍2';
        document.getElementById('team1Score').value = gameData.teams[1].score || 0;
        document.getElementById('team1ColorSelect').value = gameData.teams[1].color || '浅蓝';
        const team1Color = document.getElementById('team1Color');
        team1Color.setAttribute('data-color', gameData.teams[1].color || '');
        team1Color.style.backgroundColor = getColorValue(gameData.teams[1].color);
    }

    // 视频信息 - 设置多节视频选择
    const segments = gameData.segments || 4;
    document.getElementById('matchSegments').value = segments;
    setSegmentsVideoSelection(gameData.videos || []);

    // 评论要求
    document.getElementById('commentRequirement').value = gameData.comment_requirement || '';
}

function getColorValue(colorName) {
    const colorMap = {
        '深蓝': '#1e3a8a',
        '浅蓝': '#3b82f6',
        '红色': '#dc2626',
        '绿色': '#16a34a',
        '黄色': '#eab308',
        '橙色': '#ea580c',
        '紫色': '#9333ea',
        '粉色': '#ec4899',
        '黑色': '#1f2937',
        '白色': '#f3f4f6'
    };
    return colorMap[colorName] || '#6c757d';
}

// 编辑模式功能
async function toggleEditMode() {
    const editBtn = document.getElementById('editBtn');
    const saveBtn = document.getElementById('saveBtn');
    const cancelBtn = document.getElementById('cancelBtn');

    // 显示编辑按钮，隐藏保存和取消按钮
    editBtn.style.display = 'none';
    saveBtn.style.display = 'inline-block';
    cancelBtn.style.display = 'inline-block';

    // 启用所有输入框
    await enableEditMode();
}

async function enableEditMode() {
    // 比赛信息
    document.getElementById('matchName').readOnly = false;
    document.getElementById('matchDescription').readOnly = false;
    document.getElementById('matchSegments').readOnly = false;

    // 队伍信息
    document.getElementById('team0Name').readOnly = false;
    document.getElementById('team0Score').readOnly = false;
    document.getElementById('team0ColorSelect').disabled = false;
    document.getElementById('team1Name').readOnly = false;
    document.getElementById('team1Score').readOnly = false;
    document.getElementById('team1ColorSelect').disabled = false;

    // 显示队伍颜色选择器
    document.querySelectorAll('.team-color-select').forEach(select => {
        select.style.display = 'block';
    });

    // 视频和评论信息
    document.getElementById('commentRequirement').readOnly = false;

    // 加载视频列表到下拉框并生成节数视频选择框
    await loadVideoListForSelection();
    generateSegmentsVideoSelectors();
}

function disableEditMode() {
    // 比赛信息
    document.getElementById('matchName').readOnly = true;
    document.getElementById('matchDescription').readOnly = true;
    document.getElementById('matchSegments').readOnly = true;

    // 队伍信息
    document.getElementById('team0Name').readOnly = true;
    document.getElementById('team0Score').readOnly = true;
    document.getElementById('team0ColorSelect').disabled = true;
    document.getElementById('team1Name').readOnly = true;
    document.getElementById('team1Score').readOnly = true;
    document.getElementById('team1ColorSelect').disabled = true;

    // 隐藏队伍颜色选择器
    document.querySelectorAll('.team-color-select').forEach(select => {
        select.style.display = 'none';
    });

    // 视频和评论信息
    document.getElementById('commentRequirement').readOnly = true;

    // 禁用所有节数视频选择框
    document.querySelectorAll('.segment-video-select').forEach(select => {
        select.disabled = true;
    });
}

function cancelEdit() {
    const editBtn = document.getElementById('editBtn');
    const saveBtn = document.getElementById('saveBtn');
    const cancelBtn = document.getElementById('cancelBtn');

    // 显示编辑按钮，隐藏保存和取消按钮
    editBtn.style.display = 'inline-block';
    saveBtn.style.display = 'none';
    cancelBtn.style.display = 'none';

    // 禁用编辑模式
    disableEditMode();

    // 重新加载数据以恢复原始值
    loadGameDetail();
}

function refreshMatchDetails() {
    loadGameDetail();
}

async function saveMatchDetails() {
    if (!currentGameId) {
        showAlert('请先选择一个比赛', 'error');
        return;
    }

    try {
        // 收集表单数据
        const segments = parseInt(document.getElementById('matchSegments').value) || 4;
        const videos = [];

        // 收集各节视频
        for (let i = 1; i <= segments; i++) {
            const videoSelect = document.getElementById(`segment${i}Video`);
            if (videoSelect && videoSelect.value) {
                videos.push(videoSelect.value);
            } else {
                videos.push('');
            }
        }

        const matchData = {
            name: document.getElementById('matchName').value,
            description: document.getElementById('matchDescription').value,
            segments: segments,
            videos: videos,
            comment_requirement: document.getElementById('commentRequirement').value,
            teams: [
                {
                    name: document.getElementById('team0Name').value,
                    color: document.getElementById('team0ColorSelect').value,
                    score: parseInt(document.getElementById('team0Score').value) || 0
                },
                {
                    name: document.getElementById('team1Name').value,
                    color: document.getElementById('team1ColorSelect').value,
                    score: parseInt(document.getElementById('team1Score').value) || 0
                }
            ]
        };

        // 发送更新请求
        const response = await fetch(`${API_BASE}/game/${currentGameId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(matchData)
        });

        if (response.ok) {
            showAlert('比赛详情更新成功！', 'success');

            // 更新队伍颜色显示
            updateTeamColorDisplay();

            // 切换回查看模式
            const editBtn = document.getElementById('editBtn');
            const saveBtn = document.getElementById('saveBtn');
            const cancelBtn = document.getElementById('cancelBtn');

            editBtn.style.display = 'inline-block';
            saveBtn.style.display = 'none';
            cancelBtn.style.display = 'none';

            // 禁用编辑模式
            disableEditMode();
        } else {
            const error = await response.json();
            showAlert('更新比赛详情失败: ' + (error.detail || error.message), 'error');
        }
    } catch (error) {
        showAlert('更新比赛详情失败: ' + error.message, 'error');
    }
}

function updateTeamColorDisplay() {
    const team0Color = document.getElementById('team0Color');
    const team1Color = document.getElementById('team1Color');
    const team0ColorSelect = document.getElementById('team0ColorSelect');
    const team1ColorSelect = document.getElementById('team1ColorSelect');

    team0Color.setAttribute('data-color', team0ColorSelect.value);
    team0Color.style.backgroundColor = getColorValue(team0ColorSelect.value);

    team1Color.setAttribute('data-color', team1ColorSelect.value);
    team1Color.style.backgroundColor = getColorValue(team1ColorSelect.value);
}

// 视频功能
function copyVideoUrl() {
    const videoUrl = document.getElementById('mainVideoUrl');
    videoUrl.select();
    videoUrl.setSelectionRange(0, 99999); // 移动端兼容
    document.execCommand('copy');
    showAlert('视频链接已复制到剪贴板', 'success');
}

function previewMainVideo() {
    const videoUrl = document.getElementById('mainVideoUrl').value;
    if (!videoUrl) {
        showAlert('没有可预览的视频链接', 'error');
        return;
    }
    // 使用新的视频预览模态框
    showVideoPreview('/video/' + videoUrl);
}

// 视频选择功能
async function loadVideoListForSelection() {
    console.log('loadVideoListForSelection');
    try {
        const response = await fetch(`${API_BASE}/videos`);
        if (!response.ok) {
            throw new Error('获取视频列表失败');
        }

        const data = await response.json();
        console.log('loadVideoListForSelection', data);
        window.availableVideos = data.videos; // 存储视频列表供其他函数使用
    } catch (error) {
        showAlert('加载视频列表失败: ' + error.message, 'error');
    }
}

function generateSegmentsVideoSelectors() {
    console.log('generateSegmentsVideoSelectors');
    const segments = parseInt(document.getElementById('matchSegments').value) || 4;
    const container = document.getElementById('segmentsVideoContainer');

    container.innerHTML = '';

    for (let i = 1; i <= segments; i++) {
        const segmentDiv = document.createElement('div');
        segmentDiv.className = 'info-item';
        segmentDiv.innerHTML = `
            <label>第${i}节视频:</label>
            <div class="video-selection-container">
                <select id="segment${i}Video" class="editable-select segment-video-select">
                    <option value="">请选择视频</option>
                </select>
                <button class="btn btn-primary btn-sm" onclick="previewSegmentVideo(${i})">预览</button>
            </div>
        `;
        container.appendChild(segmentDiv);

        // 填充视频选项
        populateSegmentVideoSelect(i);
    }
}

function populateSegmentVideoSelect(segmentIndex) {
    console.log('populateSegmentVideoSelect', segmentIndex);
    const select = document.getElementById(`segment${segmentIndex}Video`);
    console.log('select', select, window.availableVideos);
    if (!select || !window.availableVideos) return;

    // 清空现有选项（保留第一个默认选项）
    select.innerHTML = '<option value="">请选择视频</option>' + window.availableVideos.map(video => `<option value="${video.name}">${video.name}</option>`).join('');

    // 添加视频选项
    window.availableVideos.forEach(video => {
        const option = document.createElement('option');
        option.value = video.name;
        option.textContent = video.name;
        console.log('append option', option);
        select.appendChild(option);
    });
}

function setSegmentsVideoSelection(videos) {
    const segments = parseInt(document.getElementById('matchSegments').value) || 4;

    // 生成节数视频选择框
    generateSegmentsVideoSelectors();

    // 设置各节视频
    for (let i = 1; i <= segments; i++) {
        const videoSelect = document.getElementById(`segment${i}Video`);
        if (videoSelect && videos[i - 1]) {
            videoSelect.value = videos[i - 1];
        }
    }
}

function previewSegmentVideo(segmentIndex) {
    const videoSelect = document.getElementById(`segment${segmentIndex}Video`);
    if (!videoSelect || !videoSelect.value) {
        showAlert('请先选择视频', 'error');
        return;
    }

    const videoUrl = `/video/${videoSelect.value}`;
    showVideoPreview(videoUrl);
}

async function loadVideoListForCreateGame() {
    try {
        const response = await fetch(`${API_BASE}/videos`);
        if (!response.ok) {
            throw new Error('获取视频列表失败');
        }

        const data = await response.json();
        populateCreateGameVideoSelect(data.videos);
    } catch (error) {
        showAlert('加载视频列表失败: ' + error.message, 'error');
    }
}

function populateVideoSelect(videos) {
    const select = document.getElementById('mainVideoSelect');
    const currentValue = select.value;

    // 清空现有选项（保留第一个默认选项）
    select.innerHTML = '<option value="">请选择主视频</option>';

    // 添加视频选项
    videos.forEach(video => {
        const option = document.createElement('option');
        option.value = video.name;
        option.textContent = video.name;
        select.appendChild(option);
    });

    // 恢复之前选中的值
    if (currentValue) {
        select.value = currentValue;
    }
}

function populateCreateGameVideoSelect(videos) {
    window.availableVideos = videos; // 存储视频列表
}

function generateCreateGameVideoSelectors() {
    const segments = parseInt(document.getElementById('gameSegments').value) || 4;
    const container = document.getElementById('createGameSegmentsContainer');

    container.innerHTML = '';

    for (let i = 1; i <= segments; i++) {
        const segmentDiv = document.createElement('div');
        segmentDiv.className = 'form-group';
        segmentDiv.innerHTML = `
            <label>第${i}节视频:</label>
            <select id="createSegment${i}Video" required>
                <option value="">请选择视频</option>
            </select>
        `;
        container.appendChild(segmentDiv);

        // 填充视频选项
        populateCreateSegmentVideoSelect(i);
    }
}

function populateCreateSegmentVideoSelect(segmentIndex) {
    const select = document.getElementById(`createSegment${segmentIndex}Video`);
    if (!select || !window.availableVideos) return;

    // 清空现有选项（保留第一个默认选项）
    select.innerHTML = '<option value="">请选择视频</option>';

    // 添加视频选项
    window.availableVideos.forEach(video => {
        console.log('populateCreateSegmentVideoSelect', video);
        const option = document.createElement('option');
        option.value = video.name;
        option.textContent = video.name;
        select.appendChild(option);
    });
}

function setMainVideoSelection(videoUrl) {
    const select = document.getElementById('mainVideoSelect');
    const urlInput = document.getElementById('mainVideoUrl');
    const urlContainer = document.querySelector('.video-url-container');

    if (videoUrl) {
        // 设置下拉框的值
        select.value = videoUrl;
        // 同时设置URL输入框的值（用于显示和复制功能）
        urlInput.value = videoUrl;
        // 显示URL容器
        urlContainer.style.display = 'block';
    } else {
        select.value = '';
        urlInput.value = '';
        urlContainer.style.display = 'none';
    }
}

// 监听视频选择变化
function onVideoSelectChange() {
    const select = document.getElementById('mainVideoSelect');
    const urlInput = document.getElementById('mainVideoUrl');
    const urlContainer = document.querySelector('.video-url-container');

    if (select.value) {
        urlInput.value = select.value;
        urlContainer.style.display = 'block';
    } else {
        urlInput.value = '';
        urlContainer.style.display = 'none';
    }
}

// 事件管理功能
let currentSegment = 1;
let allEvents = {}; // 存储所有节的事件

async function loadEvents() {
    if (!currentGameId) {
        showAlert('请先选择一个比赛', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/game/${currentGameId}/events`);
        const data = await response.json();
        allEvents = data.events || {};
        currentEvents = allEvents[currentSegment] || [];

        // 设置当前节数的视频
        switchEventSegment();
        displayEvents(currentEvents);
    } catch (error) {
        showAlert('加载事件失败: ' + error.message, 'error');
    }
}

function switchEventSegment() {
    currentSegment = parseInt(document.getElementById('eventSegmentSelect').value);
    currentEvents = allEvents[currentSegment] || [];

    // 设置当前节数的视频
    const videoSelect = document.getElementById(`segment${currentSegment}Video`);
    if (videoSelect && videoSelect.value) {
        document.getElementById('eventVideo').src = `/video/${videoSelect.value}`;
    } else {
        document.getElementById('eventVideo').src = '';
    }

    displayEvents(currentEvents);
}

function displayEvents(events) {
    const tbody = document.getElementById('eventsTableBody');
    if (events.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">暂无事件数据</td></tr>';
        return;
    }

    const eventTypeOptions = eventTypes.map(type => {
        return `<option value="${type.value}">${type.label}</option>`;
    }).join('');

    const teams = [
        document.getElementById('team0Name').value,
        document.getElementById('team1Name').value
    ];

    const teamOptions = `<option value="">请选择队伍</option>`
        + teams.map((team, index) => `<option value="${index}">${team}</option>`).join('');

    const firstRow = `
        <tr>
            <td><input type="text" id="newEventTime"><br/> <a href="#" title="设置为视频时间" onclick="setTimeAsVideoTime()">✍</a> <a href="#" title="预览" onclick="previewEventTime()">▷</a></td>
            <td><select id="newEventType">${eventTypeOptions}</select></td>
            <td><select id="newEventTeam">${teamOptions}</select></td>
            <td><input type="text" id="newEventPlayer"></td>
            <td><input type="text" id="newEventDesc"></td>
            <td>
                <button id="saveEventBtn" class="btn btn-primary" title="添加" onclick="saveEvent()">+</button>
                <button id="cancelSelectEventBtn" class="btn btn-secondary" hidden onclick="cancelSelectEvent()">×</button>
            </td>
        </tr>
    `;

    tbody.innerHTML = firstRow + events.map((event, index) => `
        <tr>
            <td>${event.time}</td>
            <td>${eventTypeMap[event.type]}</td>
            <td>${event.team !== null ? teams[event.team] : '-'}</td>
            <td>${event.player || '-'}</td>
            <td>${event.desc || '-'}</td>
            <td>
                <button class="btn btn-warning" title="编辑" onclick="selectEvent(${index})">✎</button>
                <button class="btn btn-danger" title="删除" onclick="deleteEvent(${index})">×</button>
            </td>
        </tr>
    `).join('');

}

function setTimeAsVideoTime() {
    const videoTime = document.getElementById('eventVideo').currentTime;
    document.getElementById('newEventTime').value = formatTime(videoTime);
}

function previewEventTime() {
    const eventTime = document.getElementById('newEventTime').value;
    const eventVideo = document.getElementById('eventVideo');
    const startTime = parseTime(eventTime) - 1;
    const endTime = startTime + 2;
    const videoUrl = document.getElementById('mainVideoUrl').value;
    eventVideo.src = `/video/${videoUrl}#t=${startTime},${endTime}`;
    eventVideo.play();
}

function selectEvent(index) {
    const event = currentEvents[index];
    document.getElementById('saveEventBtn').innerHTML = '✔';
    document.getElementById('saveEventBtn').title = '保存修改';
    document.getElementById('cancelSelectEventBtn').style.display = 'inline-block';
    document.getElementById('newEventTime').value = event.time;
    document.getElementById('newEventType').value = event.type;
    document.getElementById('newEventTeam').value = event.team !== null ? event.team.toString() : '';
    document.getElementById('newEventPlayer').value = event.player || '';
    document.getElementById('newEventDesc').value = event.desc || '';
    selectedEventIndex = index;
}

function cancelSelectEvent() {
    document.getElementById('saveEventBtn').innerHTML = '+';
    document.getElementById('saveEventBtn').title = '添加';
    document.getElementById('cancelSelectEventBtn').style.display = 'none';
    document.getElementById('newEventTime').value = '';
    document.getElementById('newEventType').value = '';
    document.getElementById('newEventTeam').value = '';
    document.getElementById('newEventPlayer').value = '';
    document.getElementById('newEventDesc').value = '';
    selectedEventIndex = null;
}

async function saveEvents() {
    if (!currentGameId) {
        showAlert('请先选择一个比赛', 'error');
        return;
    }

    try {
        // 更新当前节的事件
        allEvents[currentSegment] = currentEvents;

        const response = await fetch(`${API_BASE}/game/${currentGameId}/events`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(allEvents)
        });

        if (response.ok) {
            showAlert('事件保存成功！', 'success');
        } else {
            const error = await response.json();
            showAlert('保存事件失败: ' + error.detail, 'error');
        }
    } catch (error) {
        showAlert('保存事件失败: ' + error.message, 'error');
    }
}

async function saveEvent() {
    const event = {
        time: document.getElementById('newEventTime').value,
        type: document.getElementById('newEventType').value,
        team: document.getElementById('newEventTeam').value,
        player: document.getElementById('newEventPlayer').value,
        desc: document.getElementById('newEventDesc').value,
    }
    if (selectedEventIndex !== null) {
        currentEvents[selectedEventIndex] = event;
    } else {
        currentEvents.push(event);
    }
    currentEvents = currentEvents.sort((a, b) => parseTime(a.time) - parseTime(b.time));
    await saveEvents();
    cancelSelectEvent();
    displayEvents(currentEvents);
}

function deleteEvent(index) {
    if (confirm('确定要删除这个事件吗？')) {
        currentEvents.splice(index, 1);
        displayEvents(currentEvents);
    }
}

// 视频制作功能
async function loadTaskStatus() {
    if (!currentGameId) {
        showAlert('请先选择一个比赛', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/game/${currentGameId}/task/status`);
        const data = await response.json();
        displayTaskStatus(data);
    } catch (error) {
        // 如果没有任务，显示默认状态
        displayTaskStatus({
            id: currentGameId,
            status: 'no_task',
            message: '暂无任务'
        });
    }
}

function displayTaskStatus(task) {
    const statusDiv = document.getElementById('taskStatus');
    let statusHtml = '';

    if (task.status === 'no_task') {
        statusHtml = `
            <div class="alert alert-info">
                <h3>任务状态: 无任务</h3>
                <p>当前没有正在运行的任务</p>
            </div>
        `;
    } else {
        const statusClass = `status-${task.status}`;
        statusHtml = `
            <div class="alert alert-info">
                <h3>任务状态: <span class="status-badge ${statusClass}">${task.status}</span></h3>
                <p>任务ID: ${task.id}</p>
                ${task.created_at ? `<p>创建时间: ${new Date(task.created_at).toLocaleString()}</p>` : ''}
                ${task.started_at ? `<p>开始时间: ${new Date(task.started_at).toLocaleString()}</p>` : ''}
                ${task.completed_at ? `<p>完成时间: ${new Date(task.completed_at).toLocaleString()}</p>` : ''}
                ${task.error ? `<p class="alert alert-error">错误: ${task.error}</p>` : ''}
            </div>
        `;
    }

    statusDiv.innerHTML = statusHtml;
}

async function startVideoMaking() {
    if (!currentGameId) {
        showAlert('请先选择一个比赛', 'error');
        return;
    }

    const segment = parseInt(document.getElementById('videoSegmentSelect').value);

    try {
        const response = await fetch(`${API_BASE}/game/${currentGameId}/make`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ segment: segment })
        });

        if (response.ok) {
            showAlert(`第${segment}节视频制作任务已启动！`, 'success');
            loadTaskStatus();
            // 开始轮询任务状态
            startStatusPolling();
        } else {
            const error = await response.json();
            showAlert('启动视频制作失败: ' + error.detail, 'error');
        }
    } catch (error) {
        showAlert('启动视频制作失败: ' + error.message, 'error');
    }
}

async function cancelVideoMaking() {
    if (!currentGameId) {
        showAlert('请先选择一个比赛', 'error');
        return;
    }

    if (!confirm('确定要取消视频制作任务吗？')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/game/${currentGameId}/task/cancel`, {
            method: 'POST'
        });

        if (response.ok) {
            showAlert('视频制作任务已取消！', 'success');
            loadTaskStatus();
        } else {
            const error = await response.json();
            showAlert('取消视频制作失败: ' + error.detail, 'error');
        }
    } catch (error) {
        showAlert('取消视频制作失败: ' + error.message, 'error');
    }
}

function startStatusPolling() {
    if (statusPollingInterval) {
        clearInterval(statusPollingInterval);
    }

    statusPollingInterval = setInterval(() => {
        loadTaskStatus();
    }, 2000); // 每2秒检查一次状态
}

function stopStatusPolling() {
    if (statusPollingInterval) {
        clearInterval(statusPollingInterval);
        statusPollingInterval = null;
    }
}

// 评论管理功能
let currentCommentSegment = 1;
let allComments = {}; // 存储所有节的评论

async function loadComments() {
    if (!currentGameId) {
        showAlert('请先选择一个比赛', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/game/${currentGameId}/comments`);
        const data = await response.json();
        allComments = data || {};
        currentComments = allComments[currentCommentSegment] || [];
        displayComments(currentComments);
    } catch (error) {
        showAlert('加载评论失败: ' + error.message, 'error');
    }
}

function switchCommentSegment() {
    currentCommentSegment = parseInt(document.getElementById('commentSegmentSelect').value);
    currentComments = allComments[currentCommentSegment] || [];
    displayComments(currentComments);
}

function displayComments(comments) {
    const commentsList = document.getElementById('commentsList');
    if (comments.length === 0) {
        commentsList.innerHTML = '<p>暂无评论数据</p>';
        return;
    }

    commentsList.innerHTML = comments.map((comment, index) => `
        <div class="game-card">
            <h4>评论 ${index + 1}</h4>
            <p><strong>时间:</strong> ${comment.time}</p>
            <p><strong>内容:</strong> ${comment.text}</p>
            <div class="game-actions">
                <button class="btn btn-warning" onclick="editComment(${index})">编辑</button>
            </div>
        </div>
    `).join('');
}

function editComment(index) {
    const comment = currentComments[index];
    const newText = prompt('请输入新的评论内容:', comment.text);
    if (newText !== null && newText !== comment.text) {
        updateComment(index, newText);
    }
}

async function updateComment(index, newText) {
    try {
        const response = await fetch(`${API_BASE}/game/${currentGameId}/comments/${index}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                time: currentComments[index].time,
                text: newText
            })
        });

        if (response.ok) {
            showAlert('评论更新成功！', 'success');
            loadComments();
        } else {
            const error = await response.json();
            showAlert('更新评论失败: ' + error.detail, 'error');
        }
    } catch (error) {
        showAlert('更新评论失败: ' + error.message, 'error');
    }
}

async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(`${API_BASE}/upload/${encodeURIComponent(file.name)}`, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            showAlert('文件上传成功！', 'success');
            loadVideoList && loadVideoList();
            // 返回上传后的访问URL
            return `${API_BASE}/video/${encodeURIComponent(file.name)}`;
        } else {
            const error = await response.json();
            showAlert('文件上传失败: ' + (error.detail || response.statusText), 'error');
            return null;
        }
    } catch (error) {
        showAlert('文件上传失败: ' + error.message, 'error');
        return null;
    }
}

// 视频管理功能
async function loadVideoList() {
    const videoList = document.getElementById('videoList');
    videoList.innerHTML = '<div class="loading">加载中...</div>';

    try {
        const response = await fetch(`${API_BASE}/videos`);
        if (!response.ok) {
            throw new Error('获取视频列表失败');
        }

        const data = await response.json();
        displayVideoList(data.videos);
    } catch (error) {
        videoList.innerHTML = `<div class="error">加载失败: ${error.message}</div>`;
    }
}

function displayVideoList(videos) {
    const videoList = document.getElementById('videoList');

    if (videos.length === 0) {
        videoList.innerHTML = `
            <div class="empty-state">
                <h4>📁 暂无视频文件</h4>
                <p>点击"上传视频"按钮开始上传您的第一个视频文件</p>
            </div>
        `;
        return;
    }

    videoList.innerHTML = videos.map(video => `
        <div class="video-item">
            <div class="video-preview" onclick="previewVideo('${video.access_url}')">
                🎥
            </div>
            <div class="video-info">
                <div class="video-name">${video.name}</div>
                <div class="video-meta">
                    <span>📏 ${formatSize(video.size)}</span>
                    <span>📅 ${formatDate(video.last_modified)}</span>
                </div>
            </div>
            <div class="video-actions-item">
                <button class="btn btn-primary btn-sm" onclick="copyVideoUrl('${video.access_url}')">复制链接</button>
                <button class="btn btn-secondary btn-sm" onclick="previewVideo('${video.access_url}')">预览</button>
                <button class="btn btn-danger btn-sm" onclick="deleteVideo('${video.name}')">删除</button>
            </div>
        </div>
    `).join('');
}

function formatSize(size) {
    if (size < 1024) {
        return size + ' B';
    } else if (size < 1024 * 1024) {
        return (size / 1024).toFixed(2) + ' KB';
    } else if (size < 1024 * 1024 * 1024) {
        return (size / 1024 / 1024).toFixed(2) + ' MB';
    } else {
        return (size / 1024 / 1024 / 1024).toFixed(2) + ' GB';
    }
}

async function refreshVideoList() {
    await loadVideoList();
}

async function deleteVideo(videoKey) {
    if (!confirm('确定要删除这个视频文件吗？此操作不可撤销。')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/video/${encodeURIComponent(videoKey)}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || '删除失败');
        }

        showAlert('视频删除成功！', 'success');
        await loadVideoList(); // 刷新列表
    } catch (error) {
        showAlert('删除失败: ' + error.message, 'error');
    }
}

function copyVideoUrl(url) {
    navigator.clipboard.writeText(url).then(() => {
        showAlert('视频链接已复制到剪贴板！', 'success');
    }).catch(() => {
        showAlert('复制失败，请手动复制链接', 'error');
    });
}

// 视频预览功能
function previewVideo(url) {
    if (!url) {
        showAlert('没有可预览的视频链接', 'error');
        return;
    }

    // 显示视频预览模态框
    showVideoPreview(url);
}

function showVideoPreview(url) {
    const modal = document.getElementById('videoPreviewModal');
    const video = document.getElementById('previewVideo');

    // 设置视频源
    video.src = url;

    // 显示模态框
    modal.style.display = 'block';

    // 重置视频状态
    video.currentTime = 0;
    updateVideoTimeDisplay();

    // 添加事件监听器
    setupVideoEventListeners();
}

function closeVideoPreview() {
    const modal = document.getElementById('videoPreviewModal');
    const video = document.getElementById('previewVideo');

    // 暂停视频
    video.pause();

    // 隐藏模态框
    modal.style.display = 'none';

    // 清理视频源
    video.src = '';

    // 移除键盘事件监听器
    document.removeEventListener('keydown', handleVideoKeyboard);
}

function setupVideoEventListeners() {
    const video = document.getElementById('previewVideo');

    // 移除之前的事件监听器（如果存在）
    video.removeEventListener('loadedmetadata', updateVideoTimeDisplay);
    video.removeEventListener('timeupdate', updateVideoTimeDisplay);
    video.removeEventListener('ended', onVideoEnded);

    // 添加新的事件监听器
    video.addEventListener('loadedmetadata', updateVideoTimeDisplay);
    video.addEventListener('timeupdate', updateVideoTimeDisplay);
    video.addEventListener('ended', onVideoEnded);

    // 添加键盘事件监听器
    document.addEventListener('keydown', handleVideoKeyboard);
}

function handleVideoKeyboard(event) {
    const modal = document.getElementById('videoPreviewModal');
    if (modal.style.display !== 'block') return;

    const video = document.getElementById('previewVideo');

    switch (event.code) {
        case 'Space':
            event.preventDefault();
            togglePlayPause();
            break;
        case 'ArrowLeft':
            event.preventDefault();
            seekVideo(-10);
            break;
        case 'ArrowRight':
            event.preventDefault();
            seekVideo(10);
            break;
        case 'KeyM':
            event.preventDefault();
            toggleMute();
            break;
        case 'KeyF':
            event.preventDefault();
            toggleFullscreen();
            break;
        case 'Escape':
            event.preventDefault();
            closeVideoPreview();
            break;
    }
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '00:00.0';

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    const decimalSeconds = Math.floor(seconds * 10 % 10);

    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}.${decimalSeconds}`;
}

function parseTime(time) {
    const [minutes, seconds] = time.split(':');
    return parseInt(minutes) * 60 + parseFloat(seconds);
}

// 视频控制函数
function togglePlayPause() {
    const video = document.getElementById('previewVideo');

    if (video.paused) {
        video.play();
    } else {
        video.pause();
    }
}

function seekVideo(seconds) {
    const video = document.getElementById('previewVideo');

    if (video.duration && !isNaN(video.duration)) {
        const newTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
        video.currentTime = newTime;
    }
}

function toggleMute() {
    const video = document.getElementById('previewVideo');
    video.muted = !video.muted;
}

function toggleFullscreen() {
    const video = document.getElementById('previewVideo');

    if (!document.fullscreenElement) {
        if (video.requestFullscreen) {
            video.requestFullscreen();
        } else if (video.webkitRequestFullscreen) {
            video.webkitRequestFullscreen();
        } else if (video.msRequestFullscreen) {
            video.msRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 工具函数
function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;

    // 插入到页面顶部
    const container = document.querySelector('.container');
    container.insertBefore(alertDiv, container.firstChild);

    // 3秒后自动移除
    setTimeout(() => {
        alertDiv.remove();
    }, 3000);
}

// 页面初始化
document.addEventListener('DOMContentLoaded', function () {
    showMainPage();

    // 添加队伍颜色选择器变化监听器
    document.getElementById('team0ColorSelect').addEventListener('change', function () {
        const team0Color = document.getElementById('team0Color');
        team0Color.setAttribute('data-color', this.value);
        team0Color.style.backgroundColor = getColorValue(this.value);
    });

    document.getElementById('team1ColorSelect').addEventListener('change', function () {
        const team1Color = document.getElementById('team1Color');
        team1Color.setAttribute('data-color', this.value);
        team1Color.style.backgroundColor = getColorValue(this.value);
    });

    // 添加节数变化监听器
    document.getElementById('matchSegments').addEventListener('change', function () {
        if (!this.readOnly) {
            generateSegmentsVideoSelectors();
        }
    });

    // 添加创建比赛节数变化监听器
    document.getElementById('gameSegments').addEventListener('change', function () {
        generateCreateGameVideoSelectors();
    });

    // 文件上传事件监听器
    document.getElementById('videoFileInput').addEventListener('change', async function (e) {
        const file = e.target.files[0];
        if (!file) return;

        const uploadProgress = document.getElementById('uploadProgress');
        const uploadProgressFill = document.getElementById('uploadProgressFill');
        const uploadStatus = document.getElementById('uploadStatus');
        const mainVideoInput = document.getElementById('mainVideo');

        // 显示上传进度
        uploadProgress.style.display = 'block';
        uploadStatus.textContent = '准备上传...';
        uploadProgressFill.style.width = '0%';

        try {
            // 模拟上传进度
            uploadStatus.textContent = '上传中...';
            uploadProgressFill.style.width = '50%';

            // 执行上传
            const accessUrl = await uploadFile(file);

            if (accessUrl) {
                // 上传成功，刷新视频列表
                await loadVideoListForCreateGame();
                generateCreateGameVideoSelectors();
                uploadStatus.textContent = '上传完成！';
                uploadProgressFill.style.width = '100%';

                // 3秒后隐藏进度条
                setTimeout(() => {
                    uploadProgress.style.display = 'none';
                }, 3000);
            } else {
                // 上传失败
                uploadStatus.textContent = '上传失败';
                uploadProgressFill.style.width = '0%';
            }
        } catch (error) {
            uploadStatus.textContent = '上传失败: ' + error.message;
            uploadProgressFill.style.width = '0%';
        }
    });

    // 视频管理上传事件监听器
    document.getElementById('videoUploadInput').addEventListener('change', async function (e) {
        const file = e.target.files[0];
        if (!file) return;

        const uploadProgress = document.getElementById('videoUploadProgress');
        const uploadProgressFill = document.getElementById('videoUploadProgressFill');
        const uploadStatus = document.getElementById('videoUploadStatus');

        // 显示上传进度
        uploadProgress.style.display = 'block';
        uploadStatus.textContent = '准备上传...';
        uploadProgressFill.style.width = '0%';

        try {
            // 模拟上传进度
            uploadStatus.textContent = '上传中...';
            uploadProgressFill.style.width = '50%';

            // 执行上传
            const accessUrl = await uploadFile(file);

            if (accessUrl) {
                uploadStatus.textContent = '上传完成！';
                uploadProgressFill.style.width = '100%';

                // 刷新视频列表
                await loadVideoList();

                // 3秒后隐藏进度条
                setTimeout(() => {
                    uploadProgress.style.display = 'none';
                }, 3000);
            } else {
                // 上传失败
                uploadStatus.textContent = '上传失败';
                uploadProgressFill.style.width = '0%';
            }
        } catch (error) {
            uploadStatus.textContent = '上传失败: ' + error.message;
            uploadProgressFill.style.width = '0%';
        }
    });

    // 创建比赛表单提交事件监听器
    document.getElementById('createGameForm').addEventListener('submit', async function (e) {
        e.preventDefault();

        const segments = parseInt(document.getElementById('gameSegments').value) || 4;
        const videos = [];

        // 收集各节视频
        for (let i = 1; i <= segments; i++) {
            const videoSelect = document.getElementById(`createSegment${i}Video`);
            if (videoSelect && videoSelect.value) {
                videos.push(videoSelect.value);
            } else {
                videos.push('');
            }
        }

        const gameData = {
            id: document.getElementById('gameId').value,
            name: document.getElementById('gameName').value,
            segments: segments,
            videos: videos,
            teams: [
                {
                    name: document.getElementById('team0Name').value,
                    color: document.getElementById('team0Color').value,
                    code: document.getElementById('team0Name').value.toUpperCase().substring(0, 5),
                    score: 0
                },
                {
                    name: document.getElementById('team1Name').value,
                    color: document.getElementById('team1Color').value,
                    code: document.getElementById('team1Name').value.toUpperCase().substring(0, 5),
                    score: 0
                }
            ]
        };

        try {
            const response = await fetch(`${API_BASE}/game`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(gameData)
            });

            if (response.ok) {
                showAlert('比赛创建成功！', 'success');
                closeModal('createGameModal');
                document.getElementById('createGameForm').reset();
                loadGames();
            } else {
                const error = await response.json();
                showAlert('创建比赛失败: ' + error.detail, 'error');
            }
        } catch (error) {
            showAlert('创建比赛失败: ' + error.message, 'error');
        }
    });
});

// 点击模态框外部关闭
window.onclick = function (event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            if (modal.id === 'videoPreviewModal') {
                closeVideoPreview();
            } else {
                modal.style.display = 'none';
            }
        }
    });
};
