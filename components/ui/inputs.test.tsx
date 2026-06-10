import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MoneyInput } from "./MoneyInput";
import { PercentInput } from "./PercentInput";
import { QuantityInput } from "./QuantityInput";

describe("PercentInput", () => {
  it("emite number ao digitar, null no vazio e reformata no blur", () => {
    const onChange = vi.fn();
    render(<PercentInput value={30} onChange={onChange} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("30,00");

    fireEvent.change(input, { target: { value: "25,5" } });
    expect(onChange).toHaveBeenLastCalledWith(25.5);

    fireEvent.change(input, { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith(null);

    fireEvent.blur(input);
    expect(input.value).toBe("30,00");
  });
});

describe("MoneyInput", () => {
  it("emite centavos e null no vazio", () => {
    const onChange = vi.fn();
    render(<MoneyInput value={null} onChange={onChange} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "12,34" } });
    expect(onChange).toHaveBeenLastCalledWith(1234);
    fireEvent.change(input, { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});

describe("QuantityInput", () => {
  it("emite quantidade e zero quando vazio", () => {
    const onChange = vi.fn();
    render(<QuantityInput value={1} unit="kg" onChange={onChange} />);
    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    expect(input.step).toBe("0.001");

    fireEvent.change(input, { target: { value: "0.5" } });
    expect(onChange).toHaveBeenLastCalledWith(0.5);

    fireEvent.change(input, { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith(0);
  });
});
