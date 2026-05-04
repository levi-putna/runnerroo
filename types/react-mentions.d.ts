declare module "react-mentions" {
  import * as React from "react"

  export interface SuggestionDataItem {
    id: string | number
    display?: string
    [key: string]: unknown
  }

  export interface MentionProps {
    trigger: string | RegExp
    data:
      | SuggestionDataItem[]
      | ((
          query: string,
          callback: (results: SuggestionDataItem[]) => void,
        ) => void | SuggestionDataItem[])
    markup?: string
    displayTransform?: (id: string, display: string) => string
    renderSuggestion?: (
      suggestion: SuggestionDataItem,
      search: string,
      highlightedDisplay: React.ReactNode,
      index: number,
      focused: boolean,
    ) => React.ReactNode
    className?: string
    style?: React.CSSProperties
    appendSpaceOnAdd?: boolean
    allowSpaceInQuery?: boolean
    regex?: RegExp
    onAdd?: (id: string, display: string, startPos: number, endPos: number) => void
    onRemove?: (id: string, display: string, startPos: number, endPos: number) => void
    isLoading?: boolean
  }

  export class Mention extends React.Component<MentionProps> {}

  export interface MentionsInputProps
    extends Omit<
      React.TextareaHTMLAttributes<HTMLTextAreaElement>,
      "onChange" | "onSelect" | "children" | "style"
    > {
    value?: string
    onChange?: (
      event: { target: { value: string } },
      newValue: string,
      newPlainTextValue: string,
      mentions: SuggestionDataItem[],
    ) => void
    onSelect?: (event: React.SyntheticEvent) => void
    singleLine?: boolean
    className?: string
    classNames?: Record<string, string>
    style?: React.CSSProperties | Record<string, unknown>
    allowSpaceInQuery?: boolean
    allowSuggestionsAboveCursor?: boolean
    forceSuggestionsAboveCursor?: boolean
    ignoreAccents?: boolean
    suggestionsPortalHost?: HTMLElement
    inputRef?: React.Ref<HTMLTextAreaElement | null>
    customSuggestionsContainer?: (children: React.ReactNode) => React.ReactNode
    a11ySuggestionsListLabel?: string
    children: React.ReactElement | React.ReactElement[]
  }

  export class MentionsInput extends React.Component<MentionsInputProps> {}
}
