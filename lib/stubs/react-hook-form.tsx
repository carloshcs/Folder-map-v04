import * as React from "react";

export type FieldValues = Record<string, unknown>;
export type FieldPath<TFieldValues extends FieldValues> = Extract<keyof TFieldValues, string>;

export interface ControllerRenderField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> {
  field: {
    name: TName;
    value: unknown;
    onChange: (value: unknown) => void;
    onBlur: () => void;
    ref: (instance: unknown) => void;
  };
}

export interface ControllerProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  name: TName;
  defaultValue?: unknown;
  render?: (props: ControllerRenderField<TFieldValues, TName>) => React.ReactNode;
  children?: React.ReactNode;
}

interface FormContextValue {
  getFieldState: (_name: string, _state?: unknown) => { error?: { message?: string } };
}

const FormContext = React.createContext<FormContextValue>({
  getFieldState: () => ({ error: undefined }),
});

export const FormProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <FormContext.Provider value={{ getFieldState: () => ({ error: undefined }) }}>
    {children}
  </FormContext.Provider>
);

export const useFormContext = () => React.useContext(FormContext);

export const useFormState = (_props: { name: string }) => ({ touchedFields: {}, dirtyFields: {} });

export const Controller = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({ name, render, defaultValue }: ControllerProps<TFieldValues, TName>) => {
  if (!render) {
    return null;
  }

  return (
    <>{render({ field: { name, value: defaultValue, onChange: () => {}, onBlur: () => {}, ref: () => {} } })}</>
  );
};
