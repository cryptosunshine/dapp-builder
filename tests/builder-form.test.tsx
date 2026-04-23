// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { BuilderForm } from '../src/components/BuilderForm';

describe('BuilderForm', () => {
  test('fills the contract address with a sample value when requested', async () => {
    const user = userEvent.setup();

    render(<BuilderForm onSubmit={vi.fn()} isSubmitting={false} />);

    await user.click(screen.getByRole('button', { name: /use sample contract/i }));

    expect(screen.getByLabelText(/contract address/i)).toHaveValue('0xDEADBEEF');
  });
});
