export interface ComponentMember {
  name: string;
  type: string;
  optional: boolean;
  description?: string;
}

export interface ComponentEvent {
  eventName: string;
  outputName: string;
  type: string;
  description?: string;
}

export interface ComponentMeta {
  tagName: string;
  selector: string;
  className: string;
  fileName: string;
  sourceModule?: string;
  description?: string;
  members: ComponentMember[];
  events: ComponentEvent[];
}

export interface GenerateAngularWrappersResult {
  components: ComponentMeta[];
  wrappersRoot: string;
  manifestPath: string;
}
