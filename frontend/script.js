// 全局变量
const API_BASE = '';
let currentGameId = null;
let currentEvents = [];
let currentComments = [];
let statusPollingInterval = null;

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
    document.getElementById('game' + tabName.charAt(0).toUpperCase() + tabName.slice(1)).classList.add('active');

    // 添加active类到对应的标签
    const tabs = document.querySelectorAll('#gameDetailPage .tab');
    tabs.forEach(tab => {
        if (tab.textContent.includes(getTabDisplayName(tabName))) {
            tab.classList.add('active');
        }
    });

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
        'video': '视频制作',
        'comments': '评论编辑'
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
}

function showAddEventModal() {
    if (!currentGameId) {
        alert('请先选择一个比赛');
        return;
    }
    showModal('addEventModal');
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
                <button class="btn btn-primary" onclick="showGameDetail('${gameId}')">进入比赛</button>
                <button class="btn btn-danger" onclick="deleteGame('${gameId}')">删除比赛</button>
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
    document.getElementById('matchQuarter').value = gameData.quarter || 1;
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

    // 视频信息
    document.getElementById('mainVideoUrl').value = gameData.main_video || '';

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
function toggleEditMode() {
    const editBtn = document.getElementById('editBtn');
    const saveBtn = document.getElementById('saveBtn');
    const cancelBtn = document.getElementById('cancelBtn');

    // 显示编辑按钮，隐藏保存和取消按钮
    editBtn.style.display = 'none';
    saveBtn.style.display = 'inline-block';
    cancelBtn.style.display = 'inline-block';

    // 启用所有输入框
    enableEditMode();
}

function enableEditMode() {
    // 比赛信息
    document.getElementById('matchName').readOnly = false;
    document.getElementById('matchQuarter').disabled = false;
    document.getElementById('matchDescription').readOnly = false;

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
    document.getElementById('mainVideoUrl').readOnly = false;
    document.getElementById('commentRequirement').readOnly = false;
}

function disableEditMode() {
    // 比赛信息
    document.getElementById('matchName').readOnly = true;
    document.getElementById('matchQuarter').disabled = true;
    document.getElementById('matchDescription').readOnly = true;

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
    document.getElementById('mainVideoUrl').readOnly = true;
    document.getElementById('commentRequirement').readOnly = true;
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
        const matchData = {
            name: document.getElementById('matchName').value,
            quarter: parseInt(document.getElementById('matchQuarter').value),
            description: document.getElementById('matchDescription').value,
            main_video: document.getElementById('mainVideoUrl').value,
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

function previewVideo() {
    const videoUrl = document.getElementById('mainVideoUrl').value;
    if (!videoUrl) {
        showAlert('没有可预览的视频链接', 'error');
        return;
    }
    window.open(videoUrl, '_blank');
}

// 事件管理功能
async function loadEvents() {
    if (!currentGameId) {
        showAlert('请先选择一个比赛', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/game/${currentGameId}/events`);
        const data = await response.json();
        currentEvents = data.events;
        displayEvents(currentEvents);
    } catch (error) {
        showAlert('加载事件失败: ' + error.message, 'error');
    }
}

function displayEvents(events) {
    const tbody = document.getElementById('eventsTableBody');
    if (events.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">暂无事件数据</td></tr>';
        return;
    }

    tbody.innerHTML = events.map((event, index) => `
        <tr>
            <td>${event.time}</td>
            <td>${event.type}</td>
            <td>${event.team !== null ? event.team : '-'}</td>
            <td>${event.player || '-'}</td>
            <td>${event.desc || '-'}</td>
            <td>
                <button class="btn btn-warning" onclick="editEvent(${index})">编辑</button>
                <button class="btn btn-danger" onclick="deleteEvent(${index})">删除</button>
            </td>
        </tr>
    `).join('');
}

async function saveEvents() {
    if (!currentGameId) {
        showAlert('请先选择一个比赛', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/game/${currentGameId}/events`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(currentEvents)
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

function deleteEvent(index) {
    if (confirm('确定要删除这个事件吗？')) {
        currentEvents.splice(index, 1);
        displayEvents(currentEvents);
    }
}

function editEvent(index) {
    const event = currentEvents[index];
    document.getElementById('eventTime').value = event.time;
    document.getElementById('eventType').value = event.type;
    document.getElementById('eventTeam').value = event.team !== null ? event.team.toString() : '';
    document.getElementById('eventPlayer').value = event.player || '';
    document.getElementById('eventDesc').value = event.desc || '';

    // 临时存储编辑的索引
    document.getElementById('addEventForm').dataset.editingIndex = index;
    showModal('addEventModal');
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

    try {
        const response = await fetch(`${API_BASE}/game/${currentGameId}/make`, {
            method: 'POST'
        });

        if (response.ok) {
            showAlert('视频制作任务已启动！', 'success');
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
async function loadComments() {
    if (!currentGameId) {
        showAlert('请先选择一个比赛', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/game/${currentGameId}/comments`);
        const data = await response.json();
        currentComments = data;
        displayComments(currentComments);
    } catch (error) {
        showAlert('加载评论失败: ' + error.message, 'error');
    }
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

    // 创建比赛表单提交事件监听器
    document.getElementById('createGameForm').addEventListener('submit', async function (e) {
        e.preventDefault();

        const gameData = {
            id: document.getElementById('gameId').value,
            name: document.getElementById('gameName').value,
            main_video: document.getElementById('mainVideo').value,
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

    // 添加事件表单提交事件监听器
    document.getElementById('addEventForm').addEventListener('submit', function (e) {
        e.preventDefault();

        const editingIndex = this.dataset.editingIndex;
        const eventData = {
            time: document.getElementById('eventTime').value,
            type: document.getElementById('eventType').value,
            team: document.getElementById('eventTeam').value ? parseInt(document.getElementById('eventTeam').value) : null,
            player: document.getElementById('eventPlayer').value || null,
            desc: document.getElementById('eventDesc').value || null
        };

        if (editingIndex !== undefined) {
            // 编辑现有事件
            currentEvents[editingIndex] = eventData;
            delete this.dataset.editingIndex;
        } else {
            // 添加新事件
            currentEvents.push(eventData);
        }

        displayEvents(currentEvents);
        closeModal('addEventModal');
        this.reset();
    });
});

// 点击模态框外部关闭
window.onclick = function (event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
};
