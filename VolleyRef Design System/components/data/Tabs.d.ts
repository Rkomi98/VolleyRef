export interface TabItem { value: string; label: string; icon?: React.ReactNode; disabled?: boolean; }
export interface TabsProps {
  tabs: TabItem[];
  value?: string;
  onChange?: (value: string) => void;
}
export declare function Tabs(props: TabsProps): JSX.Element;
