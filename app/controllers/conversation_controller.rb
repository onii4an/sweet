class ConversationController < ApplicationController
  before_action :check_user

  def index
    current_boy.update('waiting' => true) if current_boy
    current_girl.update('waiting' => true) if current_girl
    if Boy.where(waiting: true).size > 0 && Girl.where(waiting: true).size > 0
      @offset_boy = rand(Boy.where(waiting: true).size)
      @boy_id = Boy.where(waiting: true).offset(@offset_boy).first.id
      @offset_girl = rand(Girl.where(waiting: true).size)
      @girl_id = Girl.where(waiting: true).offset(@offset_girl).first.id
      Conversation.create('boy_id' => @boy_id, 'girl_id' => @girl_id)
      ConversationJob.perform_later('created', [@boy_id, @girl_id, Conversation.where('boy_id' => @boy_id, 'girl_id' => @girl_id).first.id])
    end
  end

  private

  def check_user
    redirect_to root_path unless current_boy || current_girl
  end
end
