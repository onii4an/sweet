class ConversationsController < ApplicationController
  before_action :check_user
  helper_method :message
  helper_method :conversation_messages
  helper_method :conversation

  def show
  end

  def conversation_messages
    Message.where(conversation_id: conversation.id).page params[:page]
  end

  def message
    @message ||= Message.new
  end

  private

  def conversation
    @conversation = Conversation.find(params[:id])
  end

  def check_user
    # poop
    if conversation.boy_id == current_boy&.id && conversation.active || conversation.girl_id == current_girl&.id && conversation.active
    elsif current_admin
    else
      redirect_to root_path
    end
  end
end
