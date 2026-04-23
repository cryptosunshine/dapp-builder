// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { BuilderForm } from '../src/components/BuilderForm';
import { builderTaskInputSchema } from '../shared/schema';

describe('BuilderForm', () => {
  test('fills the contract address with a schema-valid sample value when requested', async () => {
    const user = userEvent.setup();

    render(<BuilderForm onSubmit={vi.fn()} isSubmitting={false} />);

    await user.click(screen.getByRole('button', { name: /use sample contract/i }));

    const addressInput = screen.getByLabelText(/contract address/i) as HTMLInputElement;

    expect(addressInput).toHaveValue('0x1234567890123456789012345678901234567890');
    expect(() => builderTaskInputSchema.shape.contractAddress.parse(addressInput.value)).not.toThrow();
  });
});
