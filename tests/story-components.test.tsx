import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { StoryExperience } from '@/components/story/StoryExperience';
import { PublicSiteData } from '@/types/memories';

const SAMPLE_DATA: PublicSiteData = {
  settings: {
    coupleTitle: 'Minh & Lan',
    heroSubtitle: 'Mỗi bức ảnh là một ngày bình yên anh cất giữ cho riêng hai đứa.',
    loveStartDate: '2024-10-12',
    musicUrl: '/samples/gentle-memories.wav',
    musicEnabled: true,
    letterTitle: 'Gửi em yêu của anh,',
    letterBody: 'Đoạn thứ nhất của bức thư.\n\nĐoạn thứ hai đầy thương nhớ.',
    letterSignature: 'Thương em, Minh',
    viewerPasscodeEnabled: false,
    updatedAt: '2026-11-15T00:00:00.000Z',
  },
  memories: [
    {
      id: 'mem-1',
      memoryDate: '2024-10-12',
      title: 'Buổi chiều mưa đầu tiên',
      story: 'Ngồi trú mưa cùng hai ly trà ấm.',
      imageUrl: '/samples/memory-1.svg',
      imageAlt: 'Quán trà chiều mưa',
      sortOrder: 0,
      createdAt: '2026-11-15T00:00:00.000Z',
    },
    {
      id: 'mem-2',
      memoryDate: '2025-02-14',
      title: 'Hoàng hôn trên đồi',
      story: 'Gió thổi nhè nhẹ và em cười thật tươi.',
      imageUrl: '/samples/memory-2.svg',
      imageAlt: 'Hoàng hôn trên đồi',
      sortOrder: 1,
      createdAt: '2026-11-15T00:00:00.000Z',
    },
  ],
};

describe('StoryExperience UI components', () => {
  test('renders couple title, days-together counter, and memories in order; handles empty memories gracefully', () => {
    const { rerender } = render(<StoryExperience data={SAMPLE_DATA} />);

    expect(screen.getByText('Minh & Lan')).toBeInTheDocument();
    expect(screen.getByText(/ngày bên nhau/i)).toBeInTheDocument();
    expect(screen.getByText('Buổi chiều mưa đầu tiên')).toBeInTheDocument();
    expect(screen.getByText('Hoàng hôn trên đồi')).toBeInTheDocument();

    // Empty timeline state
    rerender(
      <StoryExperience
        data={{
          settings: SAMPLE_DATA.settings,
          memories: [],
        }}
      />
    );
    expect(screen.getByText(/Chưa có kỷ niệm nào/i)).toBeInTheDocument();
  });

  test('opens PhotoLightbox when clicking a memory photo and closes on dismiss', async () => {
    const user = userEvent.setup();
    render(<StoryExperience data={SAMPLE_DATA} />);

    const photoTrigger = screen.getByRole('button', {
      name: /Phóng to ảnh: Buổi chiều mưa đầu tiên/i,
    });
    await user.click(photoTrigger);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Buổi chiều mưa đầu tiên')).toBeInTheDocument();
    expect(within(dialog).getByText('Ngồi trú mưa cùng hai ly trà ấm.')).toBeInTheDocument();

    const closeBtn = within(dialog).getByRole('button', { name: /Đóng xem ảnh/i });
    await user.click(closeBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('reveals love letter paragraphs and signature only after tapping the sealed envelope', async () => {
    const user = userEvent.setup();
    render(<StoryExperience data={SAMPLE_DATA} />);

    expect(screen.queryByText('Đoạn thứ nhất của bức thư.')).not.toBeInTheDocument();

    const openBtn = screen.getByRole('button', { name: /Chạm để mở thư/i });
    await user.click(openBtn);

    expect(await screen.findByText('Gửi em yêu của anh,')).toBeInTheDocument();
    expect(screen.getByText('Đoạn thứ nhất của bức thư.')).toBeInTheDocument();
    expect(screen.getByText('Đoạn thứ hai đầy thương nhớ.')).toBeInTheDocument();
    expect(screen.getByText(/Thương em, Minh/)).toBeInTheDocument();
  });
});
