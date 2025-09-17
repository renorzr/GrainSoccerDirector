import { Game, UpdateGameForm, TabType } from '../types';
import { GameDetailPanel } from './GameDetailPanel';
import { EventsPanel } from './EventsPanel';
import { VideoPanel } from './VideoPanel';
import { CommentsPanel } from './CommentsPanel';
import { VideosPanel } from './VideosPanel';

interface GameDetailTabsProps {
    activeTab: TabType;
    game: Game;
    editForm: UpdateGameForm | null;
    isEditMode: boolean;
    onFormChange: (field: keyof UpdateGameForm, value: any) => void;
    onTeamChange: (index: number, field: 'name' | 'color' | 'score', value: any) => void;
    onEditMode: () => void;
    onCancelEdit: () => void;
    onSaveEdit: () => void;
    saving: boolean;
    onRefresh: () => void;
}

export const GameDetailTabs: React.FC<GameDetailTabsProps> = ({
    activeTab,
    game,
    editForm,
    isEditMode,
    onFormChange,
    onTeamChange,
    onEditMode,
    onCancelEdit,
    onSaveEdit,
    saving,
    onRefresh
}) => {
    const renderTabContent = () => {
        switch (activeTab) {
            case 'detail':
                return (
                    <GameDetailPanel
                        game={game}
                        editForm={editForm}
                        isEditMode={isEditMode}
                        onFormChange={onFormChange}
                        onTeamChange={onTeamChange}
                        onEditMode={onEditMode}
                        onCancelEdit={onCancelEdit}
                        onSaveEdit={onSaveEdit}
                        saving={saving}
                        onRefresh={onRefresh}
                    />
                );
            case 'events':
                return <EventsPanel gameId={game.id} />;
            case 'video':
                return <VideoPanel gameId={game.id} />;
            case 'comments':
                return <CommentsPanel gameId={game.id} />;
            case 'videos':
                return <VideosPanel />;
            default:
                return null;
        }
    };

    return (
        <div className="tab-panel active">
            {renderTabContent()}
        </div>
    );
};
