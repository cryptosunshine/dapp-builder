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

  test('allows submitting without an API key for deterministic-only runs', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<BuilderForm onSubmit={onSubmit} isSubmitting={false} />);

    await user.type(screen.getByLabelText(/contract address/i), '0x1234567890123456789012345678901234567890');

    const submitButton = screen.getByRole('button', { name: /generate dapp preview/i });
    const form = submitButton.closest('form');
    if (!form) throw new Error('Builder form not found');

    expect(form).toBeValid();

    await user.click(submitButton);

    expect(onSubmit).toHaveBeenCalledWith({
      contractAddress: '0x1234567890123456789012345678901234567890',
      chain: 'conflux-espace-testnet',
      skill: 'token-dashboard',
      model: 'gpt-5.4',
      apiKey: '',
    });
  });
});
