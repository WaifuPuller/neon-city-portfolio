import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/useGameStore';
import { ProjectsModal } from './ProjectsModal';
import { ContactModal } from './ContactModal';
import { ArcadeModal } from './ArcadeModal';
import { SecretModal } from './SecretModal';
import { AchievementsModal } from './AchievementsModal';
import {
  AboutModal,
  SkillsModal,
  ExperienceModal,
  CredentialsModal,
  ResumeModal,
} from './InfoModals';

/**
 * Routes the active modal id to its panel. Settings and the console are
 * handled in App because they are chrome rather than portfolio content.
 */
export const ModalRoot: React.FC = () => {
  const activeModal = useGameStore((s) => s.activeModal);

  return (
    <AnimatePresence mode="wait">
      {activeModal === 'projects' && <ProjectsModal key="projects" />}
      {activeModal === 'about' && <AboutModal key="about" />}
      {activeModal === 'skills' && <SkillsModal key="skills" />}
      {activeModal === 'experience' && <ExperienceModal key="experience" />}
      {activeModal === 'credentials' && <CredentialsModal key="credentials" />}
      {activeModal === 'resume' && <ResumeModal key="resume" />}
      {activeModal === 'contact' && <ContactModal key="contact" />}
      {activeModal === 'arcade' && <ArcadeModal key="arcade" />}
      {activeModal === 'secret' && <SecretModal key="secret" />}
      {activeModal === 'achievements' && <AchievementsModal key="achievements" />}
    </AnimatePresence>
  );
};
