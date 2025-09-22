import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, Play, PenLine } from 'lucide-react';
import { eventsApi, gameApi } from '../services/api';
import { Event, EVENT_TYPES, Game } from '../types';
import { getErrorMessage, sortEventsByTime } from '../utils';
import { Alert } from './Alert';
import './EventsPanel.css';
import { parseTime, formatTime } from '../services/utils';

interface EventsPanelProps {
    gameId: string;
}

interface EventFormData {
    time: string;
    type: string;
    team: string;
    player: string;
    desc: string;
}

export const EventsPanel: React.FC<EventsPanelProps> = ({ gameId }) => {
    const [currentSegment, setCurrentSegment] = useState(1);
    const [currentEvents, setCurrentEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingEvent, setEditingEvent] = useState<number | null>(null);
    const [game, setGame] = useState<Game | null>(null);
    const [newEvent, setNewEvent] = useState<EventFormData>({
        time: '',
        type: '',
        team: '',
        player: '',
        desc: ''
    });

    useEffect(() => {
        loadGameAndEvents();
    }, [gameId]);

    useEffect(() => {
        if (game) {
            loadEvents();
        }
    }, [gameId, currentSegment, game]);

    const loadGameAndEvents = async () => {
        try {
            setLoading(true);
            setError(null);
            const gameData = await gameApi.getGame(gameId);
            setGame(gameData);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const loadEvents = async () => {
        if (!game) return;

        try {
            setLoading(true);
            setError(null);
            const events = await eventsApi.getEvents(gameId, currentSegment);
            setCurrentEvents(events);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const handleSegmentChange = (segment: number) => {
        setCurrentSegment(segment);
        setEditingEvent(null);
        setNewEvent({
            time: '',
            type: '',
            team: '',
            player: '',
            desc: ''
        });
    };

    const handleNewEventChange = (field: keyof EventFormData, value: any) => {
        setNewEvent(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSaveEvent = async () => {
        if (!newEvent.time || !newEvent.type) {
            setError('请填写时间和类型');
            return;
        }

        const event: Event = {
            time: newEvent.time,
            type: newEvent.type,
            team: newEvent.team ? parseInt(newEvent.team) : null,
            player: newEvent.player || '',
            desc: newEvent.desc || ''
        };

        let updatedEvents: Event[];

        console.log('editingEvent', editingEvent);
        if (editingEvent !== null) {
            console.log('editing existing event');
            // 编辑现有事件
            updatedEvents = [...currentEvents];
            updatedEvents[editingEvent] = event;
        } else {
            console.log('adding new event');
            // 添加新事件
            updatedEvents = [...currentEvents, event];
        }

        console.log('updatedEvents', updatedEvents);

        // 按时间排序
        updatedEvents = sortEventsByTime(updatedEvents);
        console.log('sorted updatedEvents', updatedEvents);
        setCurrentEvents(updatedEvents);

        // 保存到服务器
        await eventsApi.saveEvents(gameId, updatedEvents, currentSegment);

        // 重置表单
        setNewEvent({
            time: '',
            type: '',
            team: '',
            player: '',
            desc: ''
        });
        setEditingEvent(null);
    };

    const handleEditEvent = (index: number) => {
        const event = currentEvents[index];
        setNewEvent({
            time: event.time,
            type: event.type,
            team: event.team !== null ? event.team.toString() : '',
            player: event.player || '',
            desc: event.desc || ''
        });
        setEditingEvent(index);
    };

    const handleDeleteEvent = async (index: number) => {
        if (!window.confirm('确定要删除这个事件吗？')) {
            return;
        }

        const updatedEvents = currentEvents.filter((_, i) => i !== index);
        setCurrentEvents(updatedEvents);
        await eventsApi.saveEvents(gameId, updatedEvents, currentSegment);
    };

    const handleCancelEdit = () => {
        setNewEvent({
            time: '',
            type: '',
            team: '',
            player: '',
            desc: ''
        });
        setEditingEvent(null);
    };

    const getEventTypeLabel = (type: string) => {
        const eventType = EVENT_TYPES.find(et => et.value === type);
        return eventType ? eventType.label : type;
    };

    const getCurrentVideoUrl = () => {
        if (!game || !game.videos || game.videos.length < currentSegment) {
            return null;
        }
        const videoName = game.videos[currentSegment - 1];
        return videoName ? `/api/video/${gameId}/${encodeURIComponent(videoName)}` : null;
    };

    const jumpToVideoTime = (timeString: string) => {
        const video = document.getElementById('eventVideo') as HTMLVideoElement;
        if (!video) return;

        const totalSeconds = parseTime(timeString);

        video.currentTime = totalSeconds;
        video.play();
    };

    const setTimeFromVideo = () => {
        const video = document.getElementById('eventVideo') as HTMLVideoElement;
        if (!video) return;

        const timeString = formatTime(video.currentTime);

        setNewEvent(prev => ({
            ...prev,
            time: timeString
        }));
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading"></div>
                <span style={{ marginLeft: '1rem' }}>加载中...</span>
            </div>
        );
    }

    return (
        <div className="events-panel">
            <div className="events-header">
                <div className="segment-selector">
                    <label>选择节数:</label>
                    <select
                        value={currentSegment}
                        onChange={(e) => handleSegmentChange(parseInt(e.target.value))}
                    >
                        {game?.videos.map((_, index) => (
                            <option key={index} value={index + 1}>
                                第{index + 1}节
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {error && (
                <Alert type="error" message={error} onClose={() => setError(null)} />
            )}

            {/* 视频预览区域 */}
            <div className="video-preview-section">
                <h4>视频预览</h4>
                {getCurrentVideoUrl() ? (
                    <div className="video-container">
                        <video
                            id="eventVideo"
                            src={getCurrentVideoUrl()!}
                            controls
                            preload="metadata"
                            style={{ width: '100%', maxHeight: '400px' }}
                        >
                            您的浏览器不支持视频播放。
                        </video>
                    </div>
                ) : (
                    <div className="no-video-message">
                        <p>第{currentSegment}节没有配置视频</p>
                    </div>
                )}
            </div>

            <div className="events-table-container">
                <table className="table events-table">
                    <thead>
                        <tr>
                            <th>时间</th>
                            <th>类型</th>
                            <th>队伍</th>
                            <th>球员</th>
                            <th>描述</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* 新事件/编辑事件行 */}
                        <tr className="new-event-row">
                            <td>
                                <div className="time-input-group">
                                    <input
                                        type="text"
                                        value={newEvent.time || ''}
                                        onChange={(e) => handleNewEventChange('time', e.target.value)}
                                        placeholder="00:00.0"
                                        className="form-control"
                                    />
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-sm time-set-btn"
                                        onClick={setTimeFromVideo}
                                        title="设置为视频当前时间"
                                    >
                                        <PenLine size={14} />
                                    </button>
                                </div>
                            </td>
                            <td>
                                <select
                                    value={newEvent.type || ''}
                                    onChange={(e) => handleNewEventChange('type', e.target.value)}
                                    className="form-control"
                                >
                                    <option value="">选择类型</option>
                                    {EVENT_TYPES.map(type => (
                                        <option key={type.value} value={type.value}>
                                            {type.label}
                                        </option>
                                    ))}
                                </select>
                            </td>
                            <td>
                                <select
                                    value={newEvent.team?.toString() || ''}
                                    onChange={(e) => handleNewEventChange('team', e.target.value)}
                                    className="form-control"
                                >
                                    <option value="">请选择队伍</option>
                                    <option value="0">{game?.teams[0].name}</option>
                                    <option value="1">{game?.teams[1].name}</option>
                                </select>
                            </td>
                            <td>
                                <input
                                    type="text"
                                    value={newEvent.player || ''}
                                    onChange={(e) => handleNewEventChange('player', e.target.value)}
                                    placeholder="球员姓名"
                                    className="form-control"
                                />
                            </td>
                            <td>
                                <input
                                    type="text"
                                    value={newEvent.desc || ''}
                                    onChange={(e) => handleNewEventChange('desc', e.target.value)}
                                    placeholder="事件描述"
                                    className="form-control"
                                />
                            </td>
                            <td>
                                <div className="event-actions">
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={handleSaveEvent}
                                        title={editingEvent !== null ? '保存修改' : '添加事件'}
                                    >
                                        {editingEvent !== null ? (
                                            <Save size={16} />
                                        ) : (
                                            <Plus size={16} />
                                        )}
                                    </button>
                                    {editingEvent !== null && (
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={handleCancelEdit}
                                            title="取消编辑"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>

                        {/* 现有事件行 */}
                        {currentEvents.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="text-center">
                                    暂无事件数据
                                </td>
                            </tr>
                        ) : (
                            currentEvents.map((event, index) => (
                                <tr key={index}>
                                    <td>
                                        <button
                                            className="time-link"
                                            onClick={() => jumpToVideoTime(event.time)}
                                            title="点击跳转到视频时间点"
                                        >
                                            {event.time}
                                        </button>
                                    </td>
                                    <td>{getEventTypeLabel(event.type)}</td>
                                    <td>{event.team !== null ? game?.teams[event.team].name : '-'}</td>
                                    <td>{event.player || '-'}</td>
                                    <td>{event.desc || '-'}</td>
                                    <td>
                                        <div className="event-actions">
                                            <button
                                                className="btn btn-warning btn-sm"
                                                onClick={() => handleEditEvent(index)}
                                                title="编辑"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() => handleDeleteEvent(index)}
                                                title="删除"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
