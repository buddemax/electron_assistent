// Voice types
export type {
  AudioState,
  TranscriptionResult,
  TranscriptionSegment,
  VoiceShortcut,
  VoiceMode,
  VoiceError,
} from './voice'

// Output types
export type {
  OutputType,
  OutputVariant,
  Mode,
  GeneratedOutput,
  OutputContent,
  OutputMetadata,
  SuggestedAction,
  EmailOutput,
  EmailContent,
  TodoOutput,
  TodoContent,
  TodoItem,
  MeetingNoteOutput,
  MeetingNoteContent,
  BrainstormOutput,
  BrainstormContent,
  BrainstormIdea,
  SummaryOutput,
  SummaryContent,
  QuestionOutput,
  QuestionContent,
  AnyOutput,
} from './output'

// Knowledge types
export type {
  KnowledgeEntry,
  KnowledgeMetadata,
  EntityType,
  KnowledgeSearchResult,
  KnowledgeReference,
  SmartSuggestion,
  KnowledgeStats,
  ExtractedEntity,
  KnowledgeFilter,
} from './knowledge'

// Graph types
export type {
  GraphNode,
  GraphNodeData,
  GraphEdge,
  GraphEdgeData,
  RelationshipType,
  GraphState,
  GraphLayout,
  GraphFilter,
  GraphAnimation,
  NodePosition,
  GraphUpdate,
} from './graph'

// Settings types
export type {
  AppSettings,
  GeneralSettings,
  VoiceSettings,
  ApiSettings,
  AppearanceSettings,
  HotkeySettings,
  HotkeyConfig,
  HotkeyModifier,
} from './settings'

export { DEFAULT_SETTINGS } from './settings'

// Daily Questions types
export type {
  QuestionCategory,
  QuestionInputType,
  DailyQuestion,
  QuestionAnswer,
  SerializedQuestionAnswer,
  DailyQuestionsState,
} from './daily-questions'

export {
  DEFAULT_DAILY_QUESTIONS_STATE,
  serializeAnswers,
  deserializeAnswers,
} from './daily-questions'

// API types (excluding KnowledgeSearchResult which is exported from knowledge)
export type {
  ApiResponse,
  ApiError,
  ResponseMeta,
  TranscribeRequest,
  TranscribeResponse,
  GenerateRequest,
  GenerateResponse,
  KnowledgeSearchRequest,
  KnowledgeSearchResponse,
  KnowledgeCreateRequest,
  KnowledgeCreateResponse,
  KnowledgeUpdateRequest,
  KnowledgeDeleteRequest,
  GraphDataRequest,
  GraphDataResponse,
  SuggestionsRequest,
  SuggestionsResponse,
  DetectOutputTypeRequest,
  DetectOutputTypeResponse,
} from './api'
