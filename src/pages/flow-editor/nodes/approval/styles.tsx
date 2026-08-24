// @ts-nocheck
import styled from 'styled-components';

export const ApprovalPort = styled.div<{ $top: string }>`
  position: absolute;
  right: -12px;
  top: ${(props) => props.$top};
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  cursor: crosshair;
  ::before {
    content: '';
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1px solid #1677ff;
    background: #fff;
  }
`;
